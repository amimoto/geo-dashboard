var gps_marker = null;

var map        = null;

var tics_last  = 0;
var tics_start = new Date();

var tics_status_poll = 1000;
var gps_poll_pause   = 1; // start off with the gps not running
var gps_follow       = 1;

var route_menu_lookup = {};

var session;
var user_info;

var menu_proto = [ 

// --------------------------------------------------
    function (pixel,latlon,latlon_str) {
      var opt={}; opt[latlon_str] = function(menuItem,menu) {  
        window.prompt(
            "Location Coordinates (longitude,latitude)",
            latlon.lng()+","+latlon.lat()
        )
      }; return opt; },

    $.contextMenu.separator, 

    { 
      'Search': {
        onclick: menuaction_directions_search,
        icon: "css/images/icon-search.png"
      }
    },
    { 'Directions from here': menuaction_directions_here },
    { 'Directions to here':   menuaction_directions_here },
    { 'Get Directions':       menuaction_directions_here },

// --------------------------------------------------
    function (pixel,latlon,latlon_str) {
      if (!session) return;
      var opt={}; opt['Save Directions'] = {
          onclick: function () { gps_poll_pause = !gps_poll_pause; },
          icon: "css/images/icon-save.png"
      }; return opt; },

// --------------------------------------------------
    function (pixel,latlon,latlon_str) {
      if (!session) return;
      var opt={}; opt['Load Directions'] = {
          onclick: function () { gps_poll_pause = !gps_poll_pause; },
          icon: "css/images/icon-open.png"
      }; return opt; },

// --------------------------------------------------
    function (pixel,latlon,latlon_str) {
      var opt={}; opt['Use GPS'] = {
          onclick: function () { gps_poll_pause = !gps_poll_pause; },
          icon: ( gps_poll_pause ? "css/images/cross.png" : "css/images/accept.png" )
      }; return opt; },

// --------------------------------------------------
    function (pixel,latlon,latlon_str) {
      if ( gps_poll_pause ) return;
      var opt={}; opt['Reset GPS'] = {
          onclick: function () { jQuery.getJSON( '/gps_restart.json', {}, function () {}) },
      }; return opt; },

// --------------------------------------------------
    function (pixel,latlon,latlon_str) {
      var opt={}; opt['Follow GPS'] = {
          onclick: function () { gps_follow = !gps_follow; },
          icon: ( gps_follow ? "css/images/accept.png" : "css/images/cross.png" )
      }; return opt; },

    { 
      'Place Waypoint': {
        onclick: menuaction_place_waypoint,
        icon: "css/images/icon-place-waypoint.png"
      }
    },

// --------------------------------------------------
// HANDLE LOGIN/LOGOUT
//
    function (pixel,latlon,latlon_str) {
      var opt={}; 
      if (session) {
        opt['Logout'] = { 
          onclick: function () { menuaction_logout() },
          icon: "css/images/icon-logout.png"
        }
      }
      else {
        opt['Login'] = { 
          onclick: function () { menuaction_login() },
          icon: "css/images/icon-login.png"
        }
      };
      return opt;
    }

  ]; 

/***************************************************
 * INITIALIZATION
 ***************************************************/
$(function(){

// JQuery UI settings
  $('#map_canvas').contextMenu(
    contextmenu_event_show,
    {theme:'vista'}
  );

// JQuery UI Dialog
    $('#dialog').dialog({
        autoOpen: false,
        width: 600,
        modal: true,
        buttons: {
            "Ok": function() {
                var onsubmit = $(this).find('form').attr('onsubmit');
                var onsubmit_func = new Function(onsubmit);
                $(this).find('form').removeAttr('onsubmit').submit(onsubmit_func).trigger('submit');
                return false;
            },
            "Cancel": function() {
                $(this).dialog("close");
            }
        }
    });

// Setup the GMap interface
  if (GBrowserIsCompatible()) {
    map        = new GMap2(document.getElementById("map_canvas"));

// Create a map and let's try and center it...
    map.setCenter(
        new GLatLng(CFG["defaults"]["map_center"][0],
                    CFG["defaults"]["map_center"][1]),
                    CFG["defaults"]["map_zoom"]
    );
    map.setUIToDefault();
    window_event_resize();
    window.onresize = window_event_resize;
  };

// Setup the main toolbar
    $(".draggable").draggable();
    $("#accordion").accordion({ header: "h3", autoHeight: false });

// Setup the GPS position poll
    $().everyTime( tics_status_poll, gps_status_poll );
});

/***************************************************
 * PERIODIC EVENTS
 ***************************************************/
function window_event_resize () {
// --------------------------------------------------
  $('.fill_page').css("width",window.innerWidth)
                 .css("height",window.innerHeight);
}

function contextmenu_event_show (cmenu,t,e) {
// --------------------------------------------------
  var pixel        = new GPoint(e.pageX, e.pageY);
  var latlon       = map.fromContainerPixelToLatLng(pixel);
  var latlon_str   = sprintf( "%.05f,%.05f", latlon.lng(), latlon.lat() );
  var option_first = {};

  var menu_items = [];
  for ( var i in menu_proto ) {
    var menu_item = menu_proto[i];
    if ( 'function' == typeof menu_item ) {
      menu_item = menu_item(pixel,latlon,latlon_str);
    }
    if ( !menu_item ) continue;
    menu_items.push(menu_item);
  }
  
  return menu_items;

// Add the base options in
  option_first[latlon_str] = function(menuItem,menu) {  
    window.prompt(
        "Location Coordinates (longitude,latitude)",
        latlon.lng()+","+latlon.lat()
    )
  };
  menu_proto[0] = option_first;
  var menu_full = menu_proto.slice();

// If the user has right clicked while on a route, let's add that in too
  var routes_hovered = 0;
  for (i in route_menu_lookup ) {

// Add a separator if it's the first entry
    if ( routes_hovered == 0 )
      menu_full.push($.contextMenu.separator);

// Add a menu item
    var route_info = route_menu_lookup[i];
    var menu_new = {};
    menu_new[route_info.query] = function(){};
    menu_full.push(menu_new);

    routes_hovered++;
  }

  return menu_full;
}

function gps_status_poll () {
// --------------------------------------------------
// Request an update from the server every tics_status_poll 
// milliseconds so that we can move the user from one place 
// to another or update the POV as required :)
//
//
    var data = {};
    var now  = new Date();

// Should only be used while the streetview is updating to a new location
    if ( gps_poll_pause ) {
        return;
    };

// We don't want to double up requests so we will wait 1 second before
// issuing a new request if it hung
    if ( tics_last && ( now.getTime() - 1000 < tics_last.getTime() ) ) {
        return;
    }

// Record that we're starting a new request.
    tics_last = now;

    jQuery.getJSON( 
        '/gps_state.json', 
        data, 
        function ( data ) {
        // --------------------------------------------------
        // Receive the current status of the HMD and distance
        // travelled on the bike.
        //
            if ( isNaN(data.lat) || isNaN(data.lon) ) {
                return;
            }

            var new_position = new GLatLng( data.lat, data.lon );

            if ( !gps_marker ) {
                gps_marker = new GMarker(new_position);
                map.addOverlay(gps_marker);
            }
            else {
                gps_marker.setLatLng(new_position);
            }

            if (gps_follow) {
              map.setCenter(new_position);
            }
            return;
        }
    );
}

/***************************************************
 * DIALOG FUNCTIONS
 ***************************************************/

function dialog_load ( title, page ) {
// --------------------------------------------------
// Load the appropriate dialog into the space
//
  $('#dialog').load(
                    page,
                    null,
                    function () {
                      $('#dialog').dialog('option','title',title);
                      $('#dialog').dialog('open');
                    }
               );
}

/***************************************************
 * MENU FUNCTIONS
 ***************************************************/

function menuaction_login () {
// --------------------------------------------------
    dialog_load('Login','dialog-login.html');
}

function menuaction_logout () {
// --------------------------------------------------
    dialog_load('Logout','dialog-logout.html');
}

function menuaction_directions_search (menu_item,menu) {
// --------------------------------------------------
    dialog_load('Location Search','dialog-search.html');
}

function menuaction_directions_load (menu_item,menu) {
// --------------------------------------------------
    $('#dialog').dialog('open');
}

function menuaction_directions_here (menu_item,menu) {
// --------------------------------------------------
  alert(menu_item);
}

function menuaction_place_waypoint(menu_item,menu) {
// --------------------------------------------------
  alert(menu_item);
}

function debug_log ( msg ) {
// --------------------------------------------------
    if ( msg == "" ) {
        $('#debug').val("");
    }
    else {
        $('#debug').val( $('#debug').val() + msg + "\n" );
    }
}

function debug_logcl ( msg ) {
// --------------------------------------------------
    $('#debug').val( msg == null ? "" : msg + "\n" );
}
