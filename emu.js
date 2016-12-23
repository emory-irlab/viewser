/* ***** BEGIN LICENSE BLOCK *****
 * Version: GNU GPL 2.0 (or later)
 *
 * This program is granted free of charge for research and education purposes, 
 * free software projects, etc., but does not allow its incorporation into any 
 * type of distributed proprietary software, even in part or in translation.
 * You must obtain a license from the author to use it for commercial purposes.
 *
 * The correct paper to cite for the software is:
 * Guo, Q. and Agichtein, E. 2008. Exploring mouse movements for inferring query intent. 
 * In Proceedings of the 31st Annual international ACM SIGIR Conference on Research and Development in information Retrieval.
 * SIGIR '08. ACM, New York, NY, 707-708.
 * 
 * Additional information and updates available on the project website: 
 * http://ir.mathcs.emory.edu/EMU/
 *
 * Contributor(s): Qi Guo (qguo3@emory.edu)
 * Contributor(s): Eugene Agichtein (eugene@mathcs.emory.edu)
 *
 * ***** END LICENSE BLOCK ***** */

var _DEBUG_LEVEL = 1;
var _init = 0;
var _invalid = 1;
var _saveLocalLog = 1;
var _sendRequests = 0;
var _trackCached = 0;
/** BEGIN: TO BE CHANGED **/
var _getReqUrl = "http://irlib.library.emory.edu/";
var _postReqUrl = "http://irlib.library.emory.edu/savePage.cgi?";
//var _localDir = "J:\\Research\\user_behavior_modeling\\Libx\\Libx.v0.7\\data\\";
var _localDir = "c:\\Data\\Cache\\";

/** END: TO BE CHANGED **/
var _header = _getReqUrl +"v=EMU.0.8&wid=";
var _currHeaderUrl = "";
var _currUrl = "";
var _prevMouseMoveTime = 0;
var _mouseMoveBuff = "";
var _nMouseMove = 0;
var _nKey = 0;
var _keyBuff = "";
var _nScroll = 0; 
var _scrollBuff = "";
var _prevScrollLeft = 0;
var _prevScrollTop = 0;
var _minInterval = 500;

var _loadTab = "";
var _bl = new Array();
var _wl = new Array();
var _pageCacheDelay = 500; // delay before cahcing the page
var _prevHtmlLength = -1;
var _mouseOverOutBuff = "";

document.addEventListener("load",  onLoadCap, true); // if false, will fire just for the document - no frames
window.addEventListener("load",  onLoad, false);
window.addEventListener("unload",  onUnload, false);
window.addEventListener("mousedown",  onMouseDown, false);
window.addEventListener("mouseup",  onMouseUp, false);
window.addEventListener("click",  onClick, false);
window.addEventListener("mousemove",  onMouseMove, false);
window.addEventListener("mouseover",  onMouseOver, false);
window.addEventListener("mouseout",  onMouseOut, false); 
window.addEventListener("keypress",  onKey, false);
window.addEventListener("pageshow",  onPageShow, false); 
window.addEventListener("pagehide",  onPageHide, false);
window.addEventListener("blur",  onBlur, true); //not bubbling
window.addEventListener("focus",  onFocus, true); //not bubbling
window.addEventListener("change",  onChange, false);
window.addEventListener("scroll",  onScroll, false);
window.addEventListener("TabOpen",  onTabOpen, false); 
window.addEventListener("TabClose",  onTabClose, false);
window.addEventListener("TabSelect",  onTabSelect, false);
window.addEventListener("resize",  onResize, false);


function initbl() { // black list
	var bl = new Array();
	//bl[0] = "https";
	//bl[1] = /irlib\.library\.emory\.edu.*cgi\?user=/;
    //bl[2] = "http://www.facebook.com";    
	return bl;
}

function initwl() { // white list
	var wl = new Array();
	wl[0] = "http://www.google.com";
	wl[1] = "http://scholar.google.com";
	wl[2] = "http://search.yahoo.com";
	wl[3] = "http://www.baidu.com";
	wl[4] = "http://www.youtube.com";
	wl[5] = "http://answers.yahoo.com";
	wl[6] = "http://www.live.com";	
	wl[7] = "http://www.technorati.com";
	wl[8] = "http://www.naver.com"; 
	wl[9] = "wikipedia.org";
	wl[10] = "digg.com";
	wl[11] = "slashdot.com";
	wl[12] = "flickr.com";
	wl[13] = "del.icio.us";
	wl[14] = "delicious.com";	
	wl[15] = "http://search.live.com";
	wl[16] = "http://www.bing.com";
	wl[17] = "library.emory.edu";
	wl[18] = "http://discovere.emory.edu/";
	if (_trackCached)
		wl[19] = "file:///";
	return wl;
}


/* appends the addViewserBlur to let proxy blur the page if needed  */
function addViewser(aURI) {
    if (_current_task_num > 0) {
        var pViewser = /addViewserBlur/gi;
        var pGoogleSearch = /google[.]com\/search/gi;        
        if (_use_viewser[_current_task_num - 1] == 1 && aURI.spec.match(pGoogleSearch) && !aURI.spec.match(pViewser)) {
            // alert("start viewser");
            content.window.location.href = aURI.spec + "&addViewserBlur=1";
        }
    }
}


var myExt_urlBarListener = {
    QueryInterface: function(aIID)
    {
        if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
            aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
            aIID.equals(Components.interfaces.nsISupports))
            return this;
        throw Components.results.NS_NOINTERFACE;
    },

    onLocationChange: function(aProgress, aRequest, aURI)
    {
        addViewser(aURI);
        // being called when location change
		processNewURL(aURI);		
    },

    onStateChange: function() {},
    onProgressChange: function() {},
    onStatusChange: function() {},
    onSecurityChange: function() {},
    onLinkIconAvailable: function() {}
};

var _prev_url = '';
var _page_load_time = -1;
var _visited_urls = {};

function wasVisitedBefore(url) {
	if (_visited_urls[url] == null) {
		_visited_urls[url] = "1";
		return false;
	}
	else {
		return true;
	}
}

function processNewURL(aURI) {
        _init = 0;    
        
		// 1. send the buffers for the previous tab/window        
        var time = getTime();
        var sendData = 
		_currHeaderUrl
		+ "&ev=LocationChange0"
		+ "&time=" + time 		
		+ "&offsetX=" + content.window.pageXOffset
		+ "&offsetY=" + content.window.pageYOffset		
		+ "&screenW=" + screen.width
		+ "&screenH=" + screen.height
		+ "&iw=" + window.innerWidth
		+ "&ih=" + window.innerHeight
		+ "&ow=" + window.outerWidth 
		+ "&oh=" + window.outerHeight;
		
		var p1 = new RegExp("google.com/search");
        var p2 = new RegExp("task_description.pl");
        var p3 = new RegExp("user-study/index.html");        
		var p4 = new RegExp("ir-ub.mathcs.emory.edu");
        var is_visited;
		if (aURI.spec.indexOf('#') > 0)
			is_visited = false;
		else 
			is_visited = wasVisitedBefore(_prev_url);
		var is_not_anchored = !((_prev_url.indexOf('#') > 0) || (aURI.spec.indexOf('#') > 0));		
		console.error(is_not_anchored + "\t" + _is_ask_relevance + "\n" + _prev_url + "\n" + aURI.spec);
		if ( !p4.test(_prev_url) 
			&& !p1.test(_prev_url) 
			&& _is_ask_relevance 
			&& !p2.test(_prev_url) 
			&& !p3.test(_prev_url) 
			&& ((time - _page_load_time > 5000 && is_visited) || !is_visited)
			&& is_not_anchored) 
			{ /* ask for relevance  */
			/*&& (((time - _page_load_time > 5000) && is_visited) || !is_visited) */						            
			showRelevanceFeedbackDialog();
		}
		else 
			_is_ask_relevance = true;
		
        if (!_invalid){
			sendBuffData(_currHeaderUrl);
        }        
        sendRequest("GET", sendData);
        _prevScrollLeft = 0;
        _prevScrollTop = 0;		
        
		_prev_url = aURI.spec;
		_page_load_time = time;
        // 2. init the trackings
        _currUrl = (aURI.spec)+"";
		_currHeaderUrl = getHeaderUrl(_currUrl);
        sendData = _currHeaderUrl+"&ev=LocationChange1&time=" + getTime()
												+"&offsetX=" + content.window.pageXOffset
												+ "&offsetY=" + content.window.pageYOffset
												+ "&screenW=" + screen.width
												+ "&screenH=" + screen.height
												+ "&iw=" + window.innerWidth
												+ "&ih=" + window.innerHeight
												+ "&ow=" + window.outerWidth 
												+ "&oh=" + window.outerHeight;
		 
		//alert(sendData);
        sendRequest("GET", sendData);
		
		if (_pageLocationChangeTimer > 0)
			clearTimeout(_pageLocationChangeTimer);
		_pageLocationChangeTimer = setTimeout("postPageContent('LocationChange');",_pageCacheDelay);
		
		_domIds = new Array();
		_dupIds = new Array();
        _init = 1;	
 }

function getHeaderUrl(url)
{
    if (url==null) {
    	url = (content.document.location.href)+"";
		_currUrl = url;
    }        
    var headerUrl;
    var type = "";    

	if (onList(_wl,url)) {
		type = "w";
	}
	else if(ongl()) {
		type = "g";
	}
	else {
		type = "o";
	}
	headerUrl = _header+_loadTab+"&tab="+gBrowser.selectedTab.linkedPanel+"&type="+type+"&url="+urlencode(url) + "&participant_code=" + _participant_code + '&task_idx=' + _current_task_idx + "&task_num=" + _current_task_num;
	// append referrer if the URL not on black list
	var ref = content.document.referrer;
	if (ref != null && ref != "")
	headerUrl += "&ref="+urlencode(ref);
	_invalid = 0;
	
	// we want to track all pages 
    /*else { // truncate URL is on black list
        var indx1 = url.indexOf("//")+2;
        var indx = url.substring(indx1).indexOf("/");
		url = url.substring(0,indx1+indx+1);
        headerUrl = _header+_loadTab+"&tab="+gBrowser.selectedTab.linkedPanel+"&type=b&url="+urlencode(url);
        _invalid = 1;
    }*/
    return headerUrl;
}

var _mouseDownTime = 0;
function onMouseDown(event)
{ 
	if (isValid()) {	
		_mouseDownTime = getTime();
		var x = event.screenX-window.screenX;
		var y = event.screenY-window.screenY;
		var cx = event.clientX;			
		var cy = event.clientY; 
		var scrlX = cx + _prevScrollLeft;
		var scrlY = cy + _prevScrollTop;	
		var button = "";
		var target = event.target;
		switch(event.button)
		{
			case 0:
			  button = "L";
			  break;
			case 1:
			  button = "M";
			  break;
			case 2:
			  button = "R";
			  break;
			default:
		}
		var headerUrl = _currHeaderUrl;
		var sendData = 
			headerUrl
			+ "&ev=MouseDown"
			+ "&time=" + _mouseDownTime
			+ "&btn="+ button
			+ "&cx=" + cx 
			+ "&cy=" + cy
			+ "&scrlX=" + scrlX
			+ "&scrlY="+ scrlY				
			+ "&x=" + x 
			+ "&y=" + y 
			+ "&iw=" + window.innerWidth
			+ "&ih=" + window.innerHeight
			+ "&scrlW=" + content.document.documentElement.scrollWidth
			+ "&scrlH=" + content.document.documentElement.scrollHeight
			+ "&ow=" + window.outerWidth 
			+ "&oh=" + window.outerHeight
			+ "&targ_id=" + urlencode(target.id);		
		var tagName = target.tagName;						
		sendData += "&tag="+urlencode(tagName);
		if(tagName == "menuitem" 
			|| tagName == "toolbarbutton")
			sendData += "&label="+urlencode(target.label);
		sendData += "&DOM_path=" + urlencode(getDomPath(target));
		sendData += "&is_doc_area=" + (y - cy > 50)?1:0;	
		sendRequest("GET", sendData);
	}
}

var _mouseUpTime = 0;
function onMouseUp(event) { 
	_mouseUpTime = getTime();
 	if (isValid() && _mouseDownTime > 0) {	
		var duration = _mouseUpTime - _mouseDownTime;
		var target = event.target;
		var sendData = 
		_currHeaderUrl
		+"&ev=MouseUp"
		+"&time=" +_mouseUpTime 
		+"&duration="+duration
		+ "&targ_id=" + urlencode(target.id);	
		sendData += "&DOM_path=" + urlencode(getDomPath(target));
		var sel = content.getSelection().toString();
		if (sel&&(onList(_wl)||ongl())) {
			sendData+="&select_text="+urlencode(sel);    			
		}		
		sendRequest("GET", sendData);    
	}
}

function onDocClick(event) {
     onClick(event, true); 
}

function onClick(event, saveDoc)
{
	if (isValid()&&(onList(_wl)||ongl())) {
		var time = getTime();
		var x = event.screenX-window.screenX;
		var y = event.screenY-window.screenY;
		var cx = event.clientX;			
		var cy = event.clientY; 
	    
		var isDocArea = (y - cy > 50) ? 1 : 0;
		
		if (saveDoc != undefined) {
			if (!saveDoc && isDocArea)
				return;
			}
			
		var scrlX = cx + _prevScrollLeft;
		var scrlY = cy + _prevScrollTop;	
		var button = "";
		var target = event.target;
		switch(event.button)
		{
			case 0:
			  button = "L";
			  break;
			case 1:
			  button = "M";
			  break;
			case 2:
			  button = "R";
			  break;
			default:
		}
		var headerUrl = _currHeaderUrl;
		var sendData = 
			headerUrl
			+ "&ev=Click"
			+ "&time=" + time
			+ "&btn="+ button
			+ "&cx=" + cx 
			+ "&cy=" + cy
			+ "&scrlX=" + scrlX
			+ "&scrlY="+ scrlY				
			+ "&x=" + x 
			+ "&y=" + y 
			+ "&iw=" + window.innerWidth
			+ "&ih=" + window.innerHeight
			+ "&scrlW=" + content.document.documentElement.scrollWidth
			+ "&scrlH=" + content.document.documentElement.scrollHeight
			+ "&ow=" + window.outerWidth 
			+ "&oh=" + window.outerHeight
			+ "&targ_id=" + urlencode(target.id);		
		var tagName = target.tagName;						
		sendData += "&tag="+urlencode(tagName);
		if (tagName.toLowerCase() == 'a') 
		    sendData += "&href="+urlencode(target.href);
	    var res_info = getLiIndex(target);
	    // adds result rank, id and class name 
		if (res_info != null)
	        sendData += res_info;
		if(tagName == "menuitem" 
			|| tagName == "toolbarbutton")
			sendData += "&label="+urlencode(target.label);
		sendData += "&DOM_path=" + urlencode(getDomPath(target));
		//var isDocArea = (y - cy > 50)?1:0;
		sendData += "&is_doc_area=" + isDocArea;		
		sendRequest("GET", sendData);
	}
}

function getDistance(x, y, prevX, prevY) {	
	return Math.sqrt((x-prevX)*(x-prevX)+(y-prevY)*(y-prevY));
}

var _nTotalMove = 0;
var _timeThreshold = 50;
var _prevCX = 0;
var _prevCY = 0;
var _distanceThreshold = 5;

var _xCxDiff = 0;
var _yCyDiff = 0;
var _isDocArea = 1; // 0 - mouse in the toolbar/status bar area.
var _initMouseMove = 0;

/* for dialog opening */
var _prevMouseX = 100;
var _prevMouseY = 100;

function onMouseMove(event)
{
    if (isValid()&&(onList(_wl)||ongl())) {
		var time = getTime();
		var cx = event.clientX;			
		var cy = event.clientY; 	
		_prevMouseX = cx;
		_prevMouseY = cy;	
        var distance = getDistance(cx, cy, _prevCX, _prevCY);
		var x = event.screenX-window.screenX;
		var y = event.screenY-window.screenY;		
		var xCxDiff = x - cx;
		var yCyDiff = y - cy;
		var isDocArea = (yCyDiff > 50)?1:0;
		if (distance >= _distanceThreshold 
		|| time - _prevMouseMoveTime >= _timeThreshold
		|| xCxDiff != _xCxDiff 
		|| yCyDiff != _yCyDiff
		|| isDocArea != _isDocArea
		) {
			if (xCxDiff != _xCxDiff 
				|| yCyDiff != _yCyDiff
				|| isDocArea != _isDocArea				
				) {
				if (_initMouseMove) {
					sendMouseMoveData(_currHeaderUrl);
				} else 
					_initMouseMove = 1;
				_xCxDiff = xCxDiff;
				_yCyDiff = yCyDiff;
				_isDocArea = isDocArea;
			}			
			
			if (_nMouseMove > 0) 
				_mouseMoveBuff += "|";
            _mouseMoveBuff += 
			time +","
			+ cx + ","
			+ cy + ","
            + content.window.pageXOffset + ","
            + content.window.pageYOffset;
            _nMouseMove++;
            if (_nMouseMove == 20) {
               sendMouseMoveData(_currHeaderUrl);
            }
			_prevCX = cx;
			_prevCY = cy;
			_prevMouseMoveTime = time;			
        }
        _nTotalMove++;
    }    
}

function sendMouseMoveData(headerUrl) {
	if (headerUrl == null)
		headerUrl = _currHeaderUrl;
	if (_nMouseMove > 0) {
		var sendData = 
		headerUrl
		+ "&ev=MouseMove"
		+ "&time=" + getTime()
		+ "&xCxDiff=" + _xCxDiff
		+ "&yCyDiff=" + _yCyDiff
		+ "&is_doc_area=" + _isDocArea	
		+ "&nSampleMV=" + _nMouseMove
		+ "&nTotalMV=" + _nTotalMove
		+ "&buff=" + _mouseMoveBuff;		
		sendRequest("GET", sendData);		
		_mouseMoveBuff = "";
		_nMouseMove = 0;
		_nTotalMove = 0;		
	}
}

function sendRequest(sendType, sendData){
	if (sendData != undefined){
        var req = new XMLHttpRequest();		
        req.open(sendType, sendData, true);	        
		// by default send requests to the HTTP server
		if (_sendRequests)
			req.send(null);
		// optionally write log to local files
		var filePath = _localDir + _loadTab + ".dat";
		if (_saveLocalLog)
			writeLogFile(filePath, sendData, true);
	}
}

function writeLogFile(filePath, text, isEventLog) 
{	
	// a fake header for making the local log file resembles the HTTP access_log
	var fakeLogHeader = "192.168.0.1 - - [01/Jan/2010:00:00:00 -0500] \"GET ";
	if (isEventLog)
		text = fakeLogHeader + "/"+ text.replace(_getReqUrl, "") + "\n";	
		
	var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	file.initWithPath(filePath);
	var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
	if (isEventLog)
		foStream.init(file, 0x02 | 0x08 | 0x10, 0600, 0); //append event logs
	else
		foStream.init(file, 0x02 | 0x08 | 0x20, 0600, 0); //write page contents
	// must use a conversion stream here to properly handle multi-byte character encodings
	var converterStream = Components.classes['@mozilla.org/intl/converter-output-stream;1'].createInstance(Components.interfaces.nsIConverterOutputStream);
	var charset = 'utf-8';
	converterStream.init(foStream, charset, text.length, Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
	converterStream.writeString(text);
	converterStream.close();
	foStream.close();
}

function sendBuffData(headerUrl) {
	sendMouseMoveData(headerUrl);
	sendKeyData(headerUrl);
	sendScrollData(headerUrl);        
	sendMouseOutData();
}



function onUnload(event)
{
	gBrowser.removeProgressListener(myExt_urlBarListener); // remove location change listener
	var doc = event.target.ownerDocument || event.originalTarget;
    if (doc && doc.body) {
        doc.body.removeEventListener('DOMNodeInserted', onDOMNodeInserted, false);
    	//doc.body.removeEventListener("click",  onDocClick, false);
    }

    var time = getTime();
	var headerUrl = _currHeaderUrl;
    var sendData = headerUrl +"&ev=UnLoad&time="+time;
    if (isValid()){
		sendBuffData(headerUrl);
    }	    
	sendRequest("GET", sendData);
    _init = 0;
    sleep(_minInterval); //  for request to complete    
}

function onDOMNodeInserted(event) {
    if (event.target.nodeName.toLowerCase() == 'li')
		if (event.target.parentNode.nodeName.toLowerCase() == 'ol') {
			if (_pageDomChangeTimer > 0) // don't cache too often
				clearTimeout(_pageDomChangeTimer);			
			_pageDomChangeTimer = setTimeout("postPageContent('DomChange');",_pageCacheDelay);						
    }
}

function sleep(interval) { // time is in milli-sec
	var start = getTime();
	var sleeping  = true;
	while(sleeping) {
		var now = getTime();
		if ((now-start) > interval) {
			sleeping = false;
		}
	}
}

var _kh = new Array();
var _specialkh = new Array();
function initKeyHash()
{
	_kh['32']='spc';
	_kh['13']='ent';
	_kh['8']='bsp';

}

function initSpecialKeyHash() {
	_specialkh['33']="PageUp";
	_specialkh['34']="PageDown";
	_specialkh['37']="LArrow";
	_specialkh['38']="UArrow";
	_specialkh['39']="RArrow";
	_specialkh['40']="DArrow";
	_specialkh['45']="Insert";
	_specialkh['46']="Delete";
	_specialkh['36']="Home";
	_specialkh['35']="End";
	_specialkh['112']="F1";
	_specialkh['113']="F2";
	_specialkh['114']="F3";
	_specialkh['115']="F4";
	_specialkh['116']="F5";
	_specialkh['117']="F6";
	_specialkh['118']="F7";
	_specialkh['119']="F8";
	_specialkh['120']="F9";
	_specialkh['121']="F10";
	_specialkh['122']="F11";
	_specialkh['123']="F12";
}

function inKeyHash(kh, keyCode) {
	if (kh[keyCode] != null) {
		return true;
	} else {		
		return false;
	}
}

function onKey(e)
{ 
	/*if (isValid()) {
		if (_nKey>0) 
			_keyBuff += "|";
		if (onList(_wl)||ongl()) {
			if (e.ctrlKey) {
				_keyBuff += getTime()+","+printChar(e, "ctrl");
			}
			else if (e.altKey) {
				_keyBuff += getTime()+","+printChar(e, "alt");
			}
			else {
				_keyBuff += getTime()+","+printChar(e, "-");
			}
		}
		else {
			if (e.ctrlKey) {
				_keyBuff += getTime()+","+printChar(e, "ctrl");
			}
			else if (e.altKey) {
				_keyBuff += getTime()+","+printChar(e, "alt");
			}
		}
				
		_nKey++;
		if (_nKey == 20) {
			sendKeyData(_currHeaderUrl);
		}
	}*/
    _keyBuff = "";
}

function sendKeyData(headerUrl) {
	if (headerUrl == null)
		headerUrl = _currHeaderUrl;
	if (_nKey > 0) {
		var sendData = 
		headerUrl
		+ "&ev=KeyPress"
		+ "&time="
		+ getTime()
		+ "&buff=" + _keyBuff;
		_keyBuff = "";
		_nKey = 0;
		sendRequest("GET", sendData);											
	}
}

function printChar(e, fnkey)
{
	var keyCode = e.which;
	var str = "";
	if (inKeyHash(_kh, keyCode))
		str = _kh[keyCode];
	else if (keyCode == 0 && inKeyHash(_specialkh, e.keyCode)) 
		str = _specialkh[e.keyCode];
	else
		str = String.fromCharCode(e.charCode);
	str = fnkey + "," + urlencode(str);
	return str;
}

function matchPostUrl(url) {
	if (url) {
		// currently, contents of pages on the white list are stored
		// but additional constraints can be added
		return !onList(_bl,url);
	} else {
		return true;
	}
}


var _prevLoadUrl = null;
function onLoadCap(event) {    
	// triggered everytime a page loads
	if (isValid()) {
	  if ((typeof(event.originalTarget)!="undefined") && (typeof(event.originalTarget.location)!="undefined")) {
		var url = event.originalTarget.location.href;
		if (url == _prevLoadUrl)
		{
		  return;
		}
		_prevLoadUrl = url;

		if (_currHeaderUrl.indexOf(urlencode(url)) < 0)
		{		  
		  return;
		}
		var time = getTime();
		var sendData = _currHeaderUrl+"&ev=LoadCap&time="+time;
		sendRequest("GET", sendData); 
	  }
  }
}

var _emuIndex = 0;
var _outputDupIds = false;

function traverseDomTree() { 
  //_emuIndex = 0;  
  var bodyElement = content.document.getElementsByTagName("body").item(0);
  _resultcoordinates = "";
  traverseDomTreeRecurse(bodyElement, 0);

  //send 
  // output duplicated IDs when debug
  if (_outputDupIds && _dupIds.length > 0) {
	var dups = "";
	for (var id in _dupIds) {
		dups += "-"+id+":"+_dupIds[id];
	}
	//alert(dups);
  }
}

var _domIds = new Array();
var _dupIds = new Array();
var _resultcoordinates;
function traverseDomTreeRecurse(currElement, level) {
  var i;     
  if (currElement) {
      if(currElement.childNodes.length <= 0) {
        // This is a leaf node.
         if (!currElement.id) {
            // assign id if there does not exist one
            currElement.id = "emu_" + _emuIndex++;		
         }
         else { 
            // do nothing but keep track of duplication IDs
             if (_domIds[getDomPath(currElement)]) {		
                if (_dupIds[currElement.id] > 0) {				
                    _dupIds[currElement.id]++;
                } else {
                    _dupIds[currElement.id] = 1;
                    _dupIds.length++;
                }
                
             } else {
                _domIds[getDomPath(currElement)] = 1;
                _domIds.length++;
             }
         }
        /* track position of <li> elements as they typically used for result formatting */
          if (currElement.nodeName.toLowerCase() == "li") {
            _resultcoordinates += "|id=" + currElement.id + "&class=" + urlencode(currElement.className) + "&x0=" + get_pos_X(currElement) + "&y0=" + get_pos_Y(currElement) + "&cw=" + currElement.clientWidth + "&ch=" + currElement.clientHeight;
          } 
      } else {
        // Expand each of the children of this node.
        if (!currElement.id) {
            // assign id if there does not exist one
            currElement.id = "emu_" + _emuIndex++;		
        }  else {
            // do nothing but keep track of duplication IDs	 
             if (_domIds[getDomPath(currElement)]) {
                if (_dupIds[currElement.id] > 0) {
                    _dupIds[currElement.id]++;
                } else {
                    _dupIds[currElement.id] = 1;
                    _dupIds.length++;
                }
             } else {
                _domIds[getDomPath(currElement)] = 1;
                _domIds.length++;
             }
        }
        
        /* track position of <li> elements as they typically used for result formatting */
          if (currElement.nodeName.toLowerCase() == "li") {
            _resultcoordinates += "|id=" + currElement.id + "&class=" + urlencode(currElement.className) + "&x0=" + get_pos_X(currElement) + "&y0=" + get_pos_Y(currElement) + "&cw=" + currElement.clientWidth + "&ch=" + currElement.clientHeight;
          } 
          
        for(i = 0; currElement.childNodes.item(i); i++) {	  
            traverseDomTreeRecurse(currElement.childNodes.item(i), level+1);	  
        }
      }
  }
}

var _prevUrl = null;


function onPageShow(e)
{

	//var url = e.originalTarget.location.href;
	if (isValid()) {
		// track dup IDs when traverse DOM tree for white list pages
		_domIds = new Array();
		_dupIds = new Array();	
		// 1. GET
		var time = getTime();
		var sendData = _currHeaderUrl+"&ev=PageShow&time="+time		
		+ "&scrlW=" + content.document.documentElement.scrollWidth
		+ "&scrlH=" + content.document.documentElement.scrollHeight				
		+ "&offsetX=" + content.window.pageXOffset
		+ "&offsetY=" + content.window.pageYOffset
		+ "&bodyScrlW=" + content.document.body.scrollWidth
		+ "&bodyScrlH=" + content.document.body.scrollHeight		
		+ "&screenW=" + screen.width
		+ "&screenH=" + screen.height
		+ "&iw=" + window.innerWidth
		+ "&ih=" + window.innerHeight
		+ "&ow=" + window.outerWidth 
		+ "&oh=" + window.outerHeight
		;
        
		//2. POST
		if (_pagePageShowTimer > 0)
			clearTimeout(_pagePageShowTimer, _pageCacheDelay);
		_pagePageShowTimer = setTimeout("postPageContent('PageShow');",_pageCacheDelay);					
		sendRequest("GET", sendData);
		
    	var doc = e.target.ownerDocument || e.originalTarget;
    	if (doc && doc.body) {
    		doc.body.addEventListener('DOMNodeInserted', onDOMNodeInserted, false);
			//doc.body.addEventListener("click",  onDocClick, false);    	
    	}
    }
}
var _cache_cnt = 0;

var _debug = false;
var _rawHTML = false;

var _pageDomChangeTimer = -1;
var _pagePageShowTimer = -1;
var _pageKeyPressTimer = -1;
var _pageLocationChangeTimer = -1;
var _pageTabSelectTimer = -1;
var content_id = "none";


function postPageContent(evName) {
	var url = _currUrl;
	//var url = (content.document.location.href)+"";
	//var raw_html_content = content.document.documentElement.innerHTML;
	//var raw_head_content = content.document.head.innerHTML;
	
	var urlMatch = matchPostUrl(url);
    if (content.document.documentElement) {
        if (urlMatch) 
        {  		
            var req2 = new XMLHttpRequest();
            
            // traverse DOM tree to assign ids to all elements
            traverseDomTree();					
            
            /*
            // deprecated code 
            raw_html_content = content.document.body.innerHTML;				
            raw_html_content = '<head>  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"> ' + raw_head_content + '</head> <body>' + raw_html_content + '</body>';      
            raw_html_content = "<!DOCTYPE html> \n <html> \n"+raw_html_content+"\n</html>";
            
            var html_content = urlencode(raw_html_content);
            
            if (_rawHTML) 
                html_content = raw_html_content;
            */
            //var length = Math.min(65535, html_content.length);
            var time = getTime();
            content_id = calcSHA1(url + " " + time + " " + _participant_code);
            var sendData2 = 
                "wid="+_loadTab
                +"&content_id="+content_id
                +"&time="+time
                +"&url="+urlencode(url)
                +"&data=";
            /* sendData2 += html_content + "&type=Serp"+"&length="+html_content.length; */
            
            sendRequest("GET", _currHeaderUrl + "&ev=resultLayout&time=" + time + "&content_id=" + content_id 
                                + "&scrlW=" + content.document.documentElement.scrollWidth
                                + "&scrlH=" + content.document.documentElement.scrollHeight
                                + "&offsetX=" + content.window.pageXOffset
                                + "&offsetY=" + content.window.pageYOffset
                                + "&screenW=" + screen.width
                                + "&screenH=" + screen.height
                                + "&iw=" + window.innerWidth
                                + "&ih=" + window.innerHeight
                                + "&ow=" + window.outerWidth 
                                + "&oh=" + window.outerHeight + "&data=" + _resultcoordinates);
            
            var viewport = _currHeaderUrl + "&ev=contentCache&time=" + time + "&evSource=" + evName + "&content_id=" + content_id + "&scrlW=" 
            + content.document.documentElement.scrollWidth
            + "&scrlH=" + content.document.documentElement.scrollHeight
            + "&offsetX=" + content.window.pageXOffset
            + "&offsetY=" + content.window.pageYOffset
            + "&screenW=" + screen.width
            + "&screenH=" + screen.height
            + "&iw=" + window.innerWidth
            + "&ih=" + window.innerHeight
            + "&ow=" + window.outerWidth 
            + "&oh=" + window.outerHeight;
            if (content.document.body) {
                viewport += "&bodyScrlW=" + content.document.body.scrollWidth + "&bodyScrlH=" + content.document.body.scrollHeight;
            }
            sendRequest("GET", viewport);

            // POST
            if (_sendRequests) {
                req2.open("POST", _postReqUrl, true); 
                req2.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");       		
                req2.send(sendData2);
            }
               
            var filePath = _localDir + content_id + ".html";
            /* // old way of saving files -- to be replaced in next version  
                if (_saveLocalLog)
                writeLogFile(filePath, raw_html_content, false);
                
            */

            try {		
                var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);            
                file.initWithPath("C:\\Data\\Cache\\" + (content_id)  + ".html");
                var wbp = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(Components.interfaces.nsIWebBrowserPersist);
                wbp.persistFlags  = wbp.persistFlags  | wbp.PERSIST_FLAGS_FIXUP_ORIGINAL_DOM  | wbp.PERSIST_FLAGS_FROM_CACHE ;
                wbp.saveDocument(content.document, file, null, null, wbp.ENCODE_FLAGS_ABSOLUTE_LINKS | wbp.ENCODE_FLAGS_ABSOLUTE_LINKS, null);
            }
            catch (err) {
                time = getTime();
                sendRequest("GET", _currHeaderUrl + "&ev=contentCache&time=" + time + "&evSource=" + evName + "&content_id=" + content_id + "&error="+urlencode(err)); 
                alert(err);
            }
        }
    }
	_prevUrl = url;
}

var _prevHideTime = 0;
function onPageHide() {
	if (isValid()) {		
		var time = getTime();
        var sendData = _currHeaderUrl+"&ev=PageHide&time="+time;		  
		if(time - _prevHideTime < _minInterval)
		{
			_prevHideTime = time;
			return;
		}
		_prevHideTime = time;  
		sendRequest("GET", sendData);  
	}
}

var _prevFocusUrl = null;
function onFocus(event) {
	if (isValid()) {		
		var time = getTime();        
		if ((typeof(event.originalTarget)!="undefined") && (typeof(event.originalTarget.location)!="undefined")) {			
			var url = event.originalTarget.location.href;
			if ((url.indexOf("http://")==0)){
				if(url == _prevFocusUrl)
				{
				  return;
				}
				var sendData = getHeaderUrl(url)+"&ev=Focus&time="+time;
				_prevFocusUrl = url;	
				sendRequest("GET", sendData);  
			}			
	  }
	}
}

var _prevBlurTime = 0;
function onBlur(event) {
	if (isValid() && _prevFocusUrl!=null) {		
		var time = getTime();
		var url;
		if (event.originalTarget.location != undefined)
			url = event.originalTarget.location.href;        
		else
			url = undefined;
		_prevFocusUrl = null;
		if(time - _prevBlurTime < _minInterval)
		{
			_prevBlurTime = time;
			return;
		} 
		var sendData = getHeaderUrl(url)+"&ev=Blur&time="+time;
		_prevBlurTime = time;
		sendRequest("GET", sendData); 
	}
}

function onChange(event)
{	
    var target = event.originalTarget;       
    if (isValid()&&(onList(_wl)||ongl())) {    
        var sendData = 
		_currHeaderUrl
		+"&ev=Change"
		+"&time="+getTime()
		+"&val="+urlencode(target.value)
		+"&targ_id="+urlencode(target.id)
		+"&targ_type="+urlencode(target.type)
		; 	
		if (target.type == "checkbox") {			
			sendData += "&checked="+target.checked;
		}
        sendRequest("GET", sendData);
    }
}

function onTabOpen(event)
{	
    if (isValid()) {    
        var sendData = 
		_currHeaderUrl
		+"&ev=TabOpen"
		+"&time="+getTime()		
		; 
		sendRequest("GET", sendData);
    }
}

function onTabClose(event)
{	
    if (isValid()) {    
        var sendData = 
		_currHeaderUrl
		+"&ev=TabClose"
		+"&time="+getTime()		
		; 
		sendRequest("GET", sendData);
    }
}

function onTabSelect(event)
{	
    if (isValid()) {  
		var time = getTime();
        var sendData = 
		_currHeaderUrl
		+"&ev=TabSelect"
		+"&time="+ time		
		+ "&scrlW=" + content.document.documentElement.scrollWidth
		+ "&scrlH=" + content.document.documentElement.scrollHeight				
		+ "&offsetX=" + content.window.pageXOffset
		+ "&offsetY=" + content.window.pageYOffset
		+ "&bodyScrlW=" + content.document.body.scrollWidth
		+ "&bodyScrlH=" + content.document.body.scrollHeight		
		+ "&screenW=" + screen.width
		+ "&screenH=" + screen.height
		+ "&iw=" + window.innerWidth
		+ "&ih=" + window.innerHeight
		+ "&ow=" + window.outerWidth 
		+ "&oh=" + window.outerHeight
		; 		
		
		if (_pageTabSelectTimer > 0)
			clearTimeout(_pageTabSelectTimer, _pageCacheDelay);
		_pageTabSelectTimer = setTimeout("postPageContent('TabSelect');",_pageCacheDelay);			
		//sendData = postPageContent(sendData, time);					
		sendRequest("GET", sendData);	
    }
}

var _prevInnerWidth = null;
var _prevInnerHeight = null;
function onResize(event)
{	
    if (isValid() 
	&& _prevInnerWidth != window.innerWidth
	&& _prevInnerHeight != window.innerHeight) {    
        var sendData = 
		_currHeaderUrl
		+"&ev=Resize"
		+"&time="+getTime()	
		+ "&scrlW=" + content.document.documentElement.scrollWidth
		+ "&scrlH=" + content.document.documentElement.scrollHeight				
		+ "&offsetX=" + content.window.pageXOffset
		+ "&offsetY=" + content.window.pageYOffset
		+ "&bodyScrlW=" + content.document.body.scrollWidth
		+ "&bodyScrlH=" + content.document.body.scrollHeight		
		+ "&screenW=" + screen.width
		+ "&screenH=" + screen.height
		+ "&iw=" + window.innerWidth
		+ "&ih=" + window.innerHeight
		+ "&ow=" + window.outerWidth 
		+ "&oh=" + window.outerHeight;
		
		_prevInnerWidth = window.innerWidth;
		_prevInnerHeight = window.innerHeight;
		sendRequest("GET", sendData);
    }
}

function onScroll(e)
{	   	    	
	if (isValid()) {		
		var doc = content.document.documentElement;
		var scrollLeft = 0;
		var scrollTop = 0;
		// scroll offsets are reflected in either doc, or body (or neither)
		if (doc.scrollTop > 0 || doc.scrollLeft > 0) {
			scrollLeft = doc.scrollLeft;
			scrollTop = doc.scrollTop;
		} else if (content.document.body.scrollTop > 0 
		|| content.document.body.scrollLeft > 0) {
			scrollLeft = content.document.body.scrollLeft;
			scrollTop = content.document.body.scrollTop;
		} else {
			// record scroll events even there's no scroll offsets
		}
								
		_prevScrollLeft = scrollLeft;
		_prevScrollTop = scrollTop;
		if (_nScroll > 0)
			_scrollBuff += "|";
		_scrollBuff += getTime()+","+scrollLeft+","+scrollTop + "," +  content.window.pageXOffset + "," + content.window.pageYOffset;                
		_nScroll++;
		//alert(sendData);
		if (_nScroll == 20) {
			sendScrollData(_currHeaderUrl);              
        }      		
    }
}

function sendScrollData(headerUrl) {
	if (headerUrl == null)
		headerUrl = _currHeaderUrl;
	if (_nScroll > 0) {
		var sendData = 
		headerUrl
		+ "&ev=Scroll"
		+ "&time="
		+ getTime()
		+ "&buff=" + _scrollBuff;
		_nScroll = 0;	
		_scrollBuff = "";
		sendRequest("GET", sendData); 
	}	
}

function formatEmpty(s) {
	if (s) {
		return s;
	} else {
		return "#";
	}
	return s;
}

function getDomPath(obj) {
	var domPath = formatEmpty(obj.id);
	if (obj.parentNode) {
		do {
			obj = obj.parentNode;
			domPath += "|"+formatEmpty(obj.id);
			
		} while (obj.parentNode)
	}
	return domPath;
}

function getLiIndex(obj) {
    var res = -1;
	var ret = null;
	var li = null;
	if (obj.parentNode) {
		do {
		   	if (obj.nodeName.toLowerCase() == 'li') {
		   		li = obj; break;
		   	}
			obj = obj.parentNode;
			
		} while (obj.parentNode);
	}
	if (li) {
	    obj = li;
		do {
		   	if (obj.nodeName.toLowerCase() == 'li')
			{
		   		    ++res;
					ret = "&rank=" + res + "&className=" + obj.className + "&rid=" + obj.id;
			}
			obj = obj.previousSibling;
			
		} while (obj.previousSibling);
	}
	//return res;
	return ret;
}

function onMouseOver(event)
{
	if (isValid()&&(onList(_wl)||ongl())) {	    		
		_mouseOverOutBuff += "|" + escape(event.target.id) + ",over," + getTime() + "," +  urlencode(getDomPath(event.target));																
		if (_mouseOverOutBuff.length > 4096) {
			sendRequest("GET", _currHeaderUrl + "&ev=MouseOverOut&data=" + _mouseOverOutBuff);
			_mouseOverOutBuff = "";
		}
    }    
} 

function onMouseOut(event)
{
	if (isValid()&&(onList(_wl)||ongl())) {	    		
		_mouseOverOutBuff += "|" + escape(event.target.id) +",out," + getTime() + "," +  urlencode(getDomPath(event.target));																
		if (_mouseOverOutBuff.length > 4096) {
			sendRequest("GET", _currHeaderUrl + "&ev=MouseOverOut&data=" + _mouseOverOutBuff);
			_mouseOverOutBuff = "";
		}
    }    	
}   

function sendMouseOutData() {	
	if (_mouseOverOutBuff.length > 0) {
		sendRequest("GET", _currHeaderUrl + "&ev=MouseOverOut&data=" + _mouseOverOutBuff);
		_mouseOverOutBuff = "";
	}
}

function onLoad() {
	if(!_init) {        	 
	
	    // second argument is commented, as suggested in bug 
		gBrowser.addProgressListener(myExt_urlBarListener/*,Components.interfaces.nsIWebProgress.NOTIFY_STATE_DOCUMENT*/); // location change listener
		
		_loadTab = gBrowser.selectedTab.linkedPanel;
		_bl = initbl();
		_wl = initwl();			
		initKeyHash();
		initSpecialKeyHash();
		_currHeaderUrl = getHeaderUrl(); 
		
		var sendData = _currHeaderUrl+"&ev=Load&time="+getTime();
		sendRequest("GET", sendData);
		_prevScrollLeft = 0;
		_prevScrollTop = 0;						
		// init DOM hash tables			
		_domIds = new Array();
		_dupIds = new Array();			
		_init = 1;        
	}
}

// Utils
function urlencode(str) {
	var encode_str = escape(str); 
	// for some reason, javascript does not escape "+"
	encode_str = encode_str.replace(/\+/ig,"%2B");
	return encode_str;
}

// return in milli-sec
function getTime(date)
{
    if (date == null) {
    	date = new Date();
    } 
    return date.getTime();
}

function onList(list, url) {
	
	if (url==null) {
		headerUrl = _currHeaderUrl;		
		url = _currUrl;
		// trim the header
		// url = unescape(headerUrl.replace(_header, ""));
	}
	
	if (list.length > 2) { /* white */
		return true;
	}

	for (i = 0; i < list.length; i++) {
		if (url.match(list[i])) {
			return true;
		}		
	}
	return false;
}

// gray list: i.e., if the referrer is on white list
function ongl() {
	var ref = content.document.referrer;	
	if (ref && onList(_wl,ref)){
		return true;
	}
	return false;
}

// if the tracking code initialized and the given URL is not on black list
function isValid(url) {
	var ret = _init == 1 && _invalid==0;
	return ret;
}


// Hash Key Generator
/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS PUB 180-1
 * Version 2.0 Copyright Paul Johnston 2000 - 2002.
 * Other contributors: Greg Holt, Ydnar
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for details.
 */

/*
 * Configurable variables. You may need to tweak these to be compatible with
 * the server-side, but the defaults work in most cases.
 */
var hexcase = 0   /* hex output format. 0 - lowercase; 1 - uppercase        */
var b64pad  = ""  /* base-64 pad character. "=" for strict RFC compliance   */
var chrsz   = 8   /* bits per input character. 8 - ASCII; 16 - Unicode      */

/*
 * These are the functions you'll usually want to call
 * They take string arguments and return either hex or base-64 encoded strings
 */
function hex_sha1(s) {return binb2hex(core_sha1(str2binb(s),s.length * chrsz))}
function b64_sha1(s) {return binb2b64(core_sha1(str2binb(s),s.length * chrsz))}
function hex_hmac_sha1(key, data) { return binb2hex(core_hmac_sha1(key, data))}
function b64_hmac_sha1(key, data) { return binb2b64(core_hmac_sha1(key, data))}

/* Backwards compatibility - same as hex_sha1() */
function calcSHA1(s){return binb2hex(core_sha1(str2binb(s), s.length * chrsz))}

/*
 * Perform a simple self-test to see if the VM is working
 */
function sha1_vm_test()
{
  return hex_sha1("abc") == "a9993e364706816aba3e25717850c26c9cd0d89d"
}

/*
 * Calculate the SHA-1 of an array of big-endian words, and a bit length
 */
function core_sha1(x, len)
{
  /* append padding */
  x[len >> 5] |= 0x80 << (24 - len % 32)
  x[((len + 64 >> 9) << 4) + 15] = len

  var w = Array(80)
  var a =  1732584193
  var b = -271733879
  var c = -1732584194
  var d =  271733878
  var e = -1009589776

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a
    var oldb = b
    var oldc = c
    var oldd = d
    var olde = e

    for(var j = 0; j < 80; j++)
    {
      if(j < 16) w[j] = x[i + j]
      else w[j] = rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1)
      var t = safe_add(safe_add(rol(a, 5), ft(j, b, c, d)), 
                       safe_add(safe_add(e, w[j]), kt(j)))
      e = d
      d = c
      c = rol(b, 30)
      b = a
      a = t
    }

    a = safe_add(a, olda)
    b = safe_add(b, oldb)
    c = safe_add(c, oldc)
    d = safe_add(d, oldd)
    e = safe_add(e, olde)
  }
  return Array(a, b, c, d, e)
  
  /*
   * Perform the appropriate triplet combination function for the current
   * iteration
   */
  function ft(t, b, c, d)
  {
    if(t < 20) return (b & c) | ((~b) & d);
    if(t < 40) return b ^ c ^ d;
    if(t < 60) return (b & c) | (b & d) | (c & d);
    return b ^ c ^ d;
  }
  
  /*
   * Determine the appropriate additive constant for the current iteration
   */
  function kt(t)
  {
    return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
           (t < 60) ? -1894007588 : -899497514;
  }  
}

/*
 * Calculate the HMAC-SHA1 of a key and some data
 */
function core_hmac_sha1(key, data)
{
  var bkey = str2binb(key) 
  if(bkey.length > 16) bkey = core_sha1(bkey, key.length * chrsz)

  var ipad = Array(16), opad = Array(16)
  for(var i = 0; i < 16; i++) 
  {
    ipad[i] = bkey[i] ^ 0x36363636
    opad[i] = bkey[i] ^ 0x5C5C5C5C
  }

  var hash = core_sha1(ipad.concat(str2binb(data)), 512 + data.length * chrsz)
  return core_sha1(opad.concat(hash), 512 + 160)
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF)
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16)
  return (msw << 16) | (lsw & 0xFFFF)
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt))
}

/*
 * Convert an 8-bit or 16-bit string to an array of big-endian words
 * In 8-bit function, characters >255 have their hi-byte silently ignored.
 */
function str2binb(str)
{
  var bin = Array()
  var mask = (1 << chrsz) - 1
  for(var i = 0; i < str.length * chrsz; i += chrsz)
    bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (24 - i%32)   
  return bin
}

/*
 * Convert an array of big-endian words to a hex string.
 */
function binb2hex(binarray)
{
  var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef"
  var str = ""
  for(var i = 0; i < binarray.length * 4; i++)
  {
    str += hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8+4)) & 0xF) +
           hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8  )) & 0xF)
  }
  return str
}

/*
 * Convert an array of big-endian words to a base-64 string
 */
function binb2b64(binarray)
{
  var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  var str = ""
  for(var i = 0; i < binarray.length * 4; i += 3)
  {
    var triplet = (((binarray[i   >> 2] >> 8 * (3 -  i   %4)) & 0xFF) << 16)
                | (((binarray[i+1 >> 2] >> 8 * (3 - (i+1)%4)) & 0xFF) << 8 )
                |  ((binarray[i+2 >> 2] >> 8 * (3 - (i+2)%4)) & 0xFF)
    for(var j = 0; j < 4; j++)
    {
      if(i * 8 + j * 6 > binarray.length * 32) str += b64pad
      else str += tab.charAt((triplet >> 6*(3-j)) & 0x3F)
    }
  }
  return str;
}

/**
 Gives X position of an element 
*/
function get_pos_X(element) {
	var current_left = 0;
	if (element.offsetParent) {
		while (element.offsetParent) {
			current_left += element.offsetLeft
			element = element.offsetParent;
		}
	} else if (element.x)
		current_left += element.x;
	
	return current_left;
}

/**
 Gives Y position of an element 
*/
function get_pos_Y(element) {
	var current_top = 0;
	
	if (element.offsetParent) {
		while (element.offsetParent) {
			current_top += element.offsetTop
			element = element.offsetParent;
			
		}
	} else if (element.y)
		current_top += element.y;
	
	return current_top;
}

/* ########################  USER STUDY CODE   ################################### */

/* user study variables */
var _tasks = new Array();
var _task_order = new Array();
var _task_questions = new Array();
var _current_task_idx = -1;

var _is_ask_relevance = false;
var _current_task_question = "";
var _current_task_num = 0;
var _participant_code = 0;
var _num_tasks = -1;
/*  coding  scheme: */
var _use_viewser = new Array(0,0,0, 1,1,1, 0,0,0, 1,1,1);

initUserStudyData();

function loadTasks() {
	_tasks.push("Target Emory");
	_task_questions.push("Find the hours of the Target stores nearest to the Emory University.");

    _tasks.push("Dow Jones Industrial Average");
    _task_questions.push("How much did the Dow Jones Industrial Average increase/decrease at the end of yesterday?");

	_tasks.push("how many dead pixels ipad 3 replace");
	_task_questions.push("How many pixels must be dead on a iPad 3 before Apple will replace it? Assume the tablet is still under warranty.");

    _tasks.push("car inspection decatur, GA");
	_task_questions.push("Name four places to get a car inspection for a normal passenger car in Decatur, GA.");
    
    _tasks.push("bank of america number gatech");
	_task_questions.push("What's the phone number for Bank of America that is nearest to Georgia Tech?");

	_tasks.push("average temperature Dallas, SD");
	_task_questions.push("What is the average temperature in Dallas, SD for winter? Summer?");
   
	_tasks.push("2011 airplane crash US");
	_task_questions.push("Name three incidents of airplane crash happened in 2011 on the territory of US.");

    _tasks.push("State Radio Atlanta");
	_task_questions.push("Is the band State Radio coming to Atlanta, GA within the next year? If not, when and where will they be playing closest?");

    _tasks.push("best selling book 2011 US");
	_task_questions.push("What was the best selling book (title and author) of 2011 in US? how many copies of the book were sold in 2011 in US?");
	
	_tasks.push("Comcast Emory");
	_task_questions.push("Find the closet Comcast service center to Emory for returning rental modems.");

	_tasks.push("vegetarian restaurants Lenox Square");
	_task_questions.push("Find three vegetarian restaurants near Lenox Square");	
	
	_tasks.push("US worst drought");
	_task_questions.push("In what year did the USA experience its worst drought? What was the average precipitation in the country that year?");
    
	_num_tasks = _tasks.length;
	_current_task_idx = _participant_code - 1;
}
/* initializes user study variables */
function initUserStudyData() {
    //readTasksFromFile();    
	loadTasks();
    // randomization order, aka latin square
    for (var i = 0; i < _tasks.length; i++) {
        _task_order.push((_participant_code + i) % _num_tasks);
    }
}

/*
function readTasksFromFile() {
    // open an input stream from file
    var file = Components.classes["@mozilla.org/file/local;1"].
           createInstance(Components.interfaces.nsILocalFile);
    file.initWithPath(_user_study_path + "tasks.tsv");
	//file.initWithPath(_user_study_path + "chrome://sample/content/tasks.tsv");
    var istream = Components.classes["@mozilla.org/network/file-input-stream;1"].
              createInstance(Components.interfaces.nsIFileInputStream);
    istream.init(file, 0x01, 0444, 0);
    istream.QueryInterface(Components.interfaces.nsILineInputStream);

    // read lines into array
    var line = {}, lines = [], hasmore;
    do {
      hasmore = istream.readLine(line);
      lines.push(line.value); 
      var s = line.value.split("\t");
      _tasks.push(s[0]);
      _task_questions.push(s[1]);
    } while(hasmore);

    istream.close();
    _num_tasks = _tasks.length;
	_current_task_idx = _participant_code;
    // do something with read data
    //alert(_tasks.length);
}
*/

/* saves information of the event */
function logEvent(ev_name, data) {
	var time = getTime();
	var headerUrl = _currHeaderUrl;
	var sendData = headerUrl +"&ev="+ev_name+"&time=" + time + data;
    sendRequest("GET", sendData);
}

/* advances task */
function advanceTask() {
		_current_task_num++;
		if (_current_task_num > _num_tasks) {
			content.document.location.href = "http://ir-ub.mathcs.emory.edu/intent/user-study/thanks.html";
			logEvent('TaskEnd','');
            showPostTaskQuestion();
			logEvent('StudyEnd','');
            _is_ask_relevance = false;
		}
		else {
			if (_current_task_num > 1) {
				/* ask for relevance */
				var time = getTime();
				var p1 = new RegExp("google.com/search");
				var p2 = new RegExp("ir-ub.mathcs.emory.edu");
				var p3 = new RegExp("user-study/index.html");        
				var is_visited = wasVisitedBefore(_prev_url);
				
				if (!p1.test(_prev_url) && _is_ask_relevance && !p2.test(_prev_url) && !p3.test(_prev_url) && ((time - _page_load_time > 5000) && is_visited || !is_visited)) { /* ask for relevance  */            										
					showRelevanceFeedbackDialog();
				}
		
                showPostTaskQuestion();
                logEvent('TaskEnd','');
            }
			_current_task_idx = (_current_task_idx + 1) % _num_tasks;
			var task_dcrp = document.getElementById("question_description");
			task_dcrp.value = _task_questions[_current_task_idx];
            var ext = "html";
            if (_use_viewser[_current_task_num - 1] == 1)
                ext = "xhtml";
            else { 
                ext = "html";
            }
			content.document.location.href = 'http://ir-ub.mathcs.emory.edu/intent/user-study/task_description.pl?desc=' + urlencode(_task_questions[_current_task_idx]) + "&index=" + _current_task_idx + "&task_num=" + _current_task_num  + "&ext="+ext;
            _is_ask_relevance = false;
			if (_current_task_num == 1)
				logEvent('StudyBegin','');
			logEvent('NextTaskStart','');
		}
}

/*  pops up a dialog with tasl feedback question; 
   - timings used to filter eye tracking data
 */
 
function showPostTaskQuestion() {    
	logEvent("PostTaskQuestionOpen", "");        
    var params = {inn:null, out:null};
    var feedback_window = openDialog("chrome://sample/content/post-task-question.xul", "", "chrome, dialog, modal", params);
    
    if (params.out != null) {        
		logEvent("TaskFeedback", "&success_val=" + params.out.success_val + "&diff_val=" + params.out.diff_val + "&comment="+ urlencode(params.out.comment));        
    }
    else {    
         //alert("empty"); // error */
		logEvent("Error", "&msg=" + urlencode("could not record task difficulty"));
    }
    logEvent("PostTaskQuestionClose", "");
}

function showRelevanceFeedbackDialog() {    
	logEvent("FeedbackDialogOpen", "");
    var params = {inn:null, out:null};	
    var feedback_window = openDialog("chrome://sample/content/relevance-dialog.xul", "", "chrome, dialog, modal,left=" + Math.min(_prevMouseX, 800) + ",top=" + Math.min(_prevMouseY, 800), params);
    //feedback_window.focus();
    
    if (params.out != null) {
        /* alert("relevance label = " + params.out.rel_val + "  !!!! "); // OK */        
		logEvent("RelevanceLabel", "&rel_val=" + params.out.rel_val);
    }
    else {    
        /* alert("empty"); // error */
		logEvent("Error", "&msg=" + urlencode("cannot record relevance label"));
    }
    logEvent("FeedbackDialogClose", "");
    return true;
}


