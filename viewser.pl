#!/usr/bin/perl
use strict;
use open ':encoding(utf8)';
use URI::Escape; 

my $task = "11";
open(HTML, $task.".html");
my $response_txt = join("", <HTML>);
# print $response_txt;
close(HTML);
open(XHTML, "|html2xhtml -o tmp") || die "html2xhmtl failed: $!\n";
print XHTML $response_txt;
close(XHTML);
open(TMP, "tmp");
my $xhtml = join("", <TMP>);
close(TMP);
# apply blurring if needed 

## xml schema fix 
my $find = quotemeta '<html xmlns="http://www.w3.org/1999/xhtml">';
my $replace = '<html xmlns:svg="http://www.w3.org/2000/svg" lang="en" xml:lang="en" xmlns="http://www.w3.org/1999/xhtml">';
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

print "saving to ".$task.".xhtml"."\n";
open(FILE, ">".$task.".xhtml");
print FILE $xhtml;
close(FILE);
#print $xhtml;