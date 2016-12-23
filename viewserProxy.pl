#!/usr/bin/perl

#Version 1.00


use strict;

use HTTP::Proxy;
use HTTP::Proxy::BodyFilter::complete;

# initialisation
my $proxy = HTTP::Proxy->new( host =>'170.140.151.193', port => 8088 );
close STDERR;

# This logs the queries and clicks
$proxy->push_filter( request => LogClicks->new() );

# By forcing the client not to cache, we get all clicks, not just first-time clicks
# Depending on the setting, we might not want to do this.
$proxy->push_filter( response => NoCache->new() );


# Changes the user agent to avoid content from Bing being compressed
$proxy->push_filter( host => 'google.com',  path => 'search', request => NoCompression->new() );

# This catches the results of Bing requests
$proxy->push_filter( host => 'google.com',
					 response => HTTP::Proxy::BodyFilter::complete->new, 
					 response => LogQueries->new());

# Viewser 
$proxy->push_filter( host => 'google.com',  path => 'search', response => Viewser->new() ); 
$proxy->push_filter( host => 'google.com',  path => 'search', response => NoCompressionClient->new() ); 


$proxy->start;

############### CLICK LOGGING ################
{
    package LogClicks;
    use base qw( HTTP::Proxy::HeaderFilter );

    sub filter {
        my ( $self, $headers, $message ) = @_;

        my $url = $message->url;
		my $referer = $headers->header('Referer');
		
		# If the referer is Bing, its a follow on request
		# Only keep non-bing requests
		if ($referer =~ /google.com\/search\?q=([^&]*)/ && $url !~ /google.com/ && $url !~ /bing.net/) 
		{
			my $query = $1;
			my $date = scalar localtime;
			my $ip = $headers->header('X-Forwarded-For');
						
			print "CLICK\t$date\t$query\t$ip\t$url\n";
		}
    }
}

########### RESULT LOGGING ############
{
    package LogQueries;
    use base qw( HTTP::Proxy::BodyFilter );

    sub filter {
        my ( $self, $dataref, $response, $protocol, $buffer ) = @_;

        my $url = $response->base;
		
        # If its a Bing request, and its the last chunk of the request (all the data is present)
		# Sometimes this doesn't get called, and we miss a query due to HTTP weirdness.
        if ($url =~ /^http:\/\/www.bing.com\/search?/ && !defined($buffer)) 
		{
			# Log the query
			if ($url =~ /\?q=([^&]*)/) {
				my $query = $1;
				my $date = $response->header('Date');
				my $ip = $response->request->header('X-Forwarded-For');
								
				# Collect the results
				my $results = "";
				while ($$dataref =~ /<h3><a[^>]*href="(http[^"]*)"[^>]*SERP/g)
				{
					$results .= "$1;";
				}

				print "QUERY\t$date\t$query\t$ip\t$results\n";
			}			
        }		
    }
}

############## CLIENT HEADER REWRITING ##############
{
    package NoCompressionClient;
    use base qw( HTTP::Proxy::HeaderFilter );

    # changes the User-Agent header in all requests
    sub filter {
        my ( $self, $headers, $message ) = @_;
        # $message->headers->header( User_Agent => 'Mozilla/5.0' );
        $message->headers->header( 'Content-Type' => 'application/xhtml+xml' );
        $message->headers->header( 'Charset' => 'utf-8' );
    }
}

############## HEADER REWRITING ##############
{
    package NoCompression;
    use base qw( HTTP::Proxy::HeaderFilter );

    # changes the User-Agent header in all requests
    sub filter {
        my ( $self, $headers, $message ) = @_;

		$message->headers->header( User_Agent => 'Mozilla/5.0' );
		$message->headers->header( Accept => 'application/xml,text/xml' );
        # $message->headers->header( Accept => 'application/xhtml+xml' );        
    }
}

{
	package NoCache;
    use base qw( HTTP::Proxy::HeaderFilter );

	# Tells the web browser not to cache pages where the referer is Bing
    sub filter {
        my ( $self, $headers, $message ) = @_;

		my $referer = $message->request->headers->header("referer");
		if ($referer =~ /bing/) {
			$message->headers->header( 'Cache-Control' => 'no-cache' );
		}
    }
}

# 
# The code below requires html2xhtml to be installed in the system. Currently it uses temporary file for converting html to xhtml (should be re-written e.g. with pipes without stotring the web page content).   
#
########### VIEWSER CODE INJECTION #################
{
	package Viewser;
    use base qw( HTTP::Proxy::BodyFilter );
    use open ':encoding(utf8)';
	use URI::Escape; 
	sub filter {
        my ( $self, $dataref, $response, $protocol, $buffer ) = @_; 
        my $url = $response->base;
        if ($url =~ /^http:\/\/www.google.com\/search?/ && !defined($buffer))  {
            #$$dataref = "hello bing ";
            my $find = quotemeta '<head>';
            my $replace = '<head>\n<base href="http://www.google.com/"> ';
            my $response_txt = $$dataref;
            $response_txt =~ s/$find/$replace/g;        
            open(XHTML, "|html2xhtml > /var/www/lab/tmp") || die "html2xhmtl failed: $!\n";
            print XHTML $response_txt;
            close(XHTML);
            open(TMP, "tmp");
            my $xhtml = join("", <TMP>);
            close(TMP);
            
            ## xml schema fix 
            $find = quotemeta '<html xmlns="http://www.w3.org/1999/xhtml">';
            $replace = '<html xmlns:svg="http://www.w3.org/2000/svg" lang="en" xml:lang="en" xmlns="http://www.w3.org/1999/xhtml">';
            $xhtml =~ s/$find/$replace/ig;

            ## addding blurring style for <li> elements
            $find = quotemeta '<head>';
            $replace = '<head> '."\n".' <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>  '."\n".' <style type="text/css">'."\n".' li{filter:url(#make-blur); opacity:0.9} '."\n".' li:hover{ filter:url(#release-blur); opacity:1.0} </style>';
            $xhtml =~ s/$find/$replace/;
            
            ## add svg object into the document body 
            $find = quotemeta "</body>";
            $replace = '<svg:svg> '."\n".' <svg:filter id="make-blur"> '."\n".' <svg:feGaussianBlur stdDeviation="2.0" />'."\n".'<svg:feColorMatrix values="'."\n".' 0.3333 0.3333 0.3333 0 0 '."\n".' 0.3333 0.1333 0.3333 0  0 '."\n".' 0.3333 0.3333 0.1333 0 0 '."\n".' 0      0      0      1 0  "/> '."\n".' </svg:filter>'."\n".' <svg:filter id="release-blur">'."\n".' <svg:feGaussianBlur stdDeviation="0.0001" /> '."\n".'</svg:filter> '."\n
            ".' </svg:svg></body>';
            $xhtml =~ s/$find/$replace/;
            
            # feed content back 
            $$dataref = $xhtml;
        }
	}
}