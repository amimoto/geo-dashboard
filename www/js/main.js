var gps_marker = null;

var map        = null;

var tics_last  = 0;
var tics_start = new Date();

var tics_status_poll = 1000;
var gps_poll_pause   = 1; // start off with the gps not running
var gps_follow       = 1;

var route_stack       = [];
var route_menu_lookup = {};

var settings = {};

var session;
var user_info;
var menu_route;

/***********************************************************************
 * This structure controls the context menu. Note that the context
 * menu is recreated with every right click so we have the ability to 
 * add/remove/modify elements however we wish.
 **********************************************************************/
var menu_proto = [ 

// --------------------------------------------------
// Locate where the user is on the map and show them the
// latitude, longitude coodinates
//
    function (pixel,latlon,latlon_str) {
      var opt={}; opt[latlon_str] = function(menuItem,menu) {  
        window.prompt(
            "Location Coordinates (longitude,latitude)",
            latlon.lng()+","+latlon.lat()
        )
      }; return opt; },

    $.contextMenu.separator, 

    { 
      'Overlays': {
        onclick: menuaction_overlays,
      }
    },


    { 
      'Search': {
        onclick: menuaction_search,
        icon: "css/images/icon-search.png"
      }
    },

    { 
      'Get Directions': {
        onclick: menuaction_directions,
        icon: "css/images/icon-direction-search.png"
      }
    },
    { 'Directions from here': menuaction_directions_here },
    { 'Directions to here':   menuaction_directions_here },

// --------------------------------------------------
// This should only be shown when right-clicking on a
// direction/route. This will allow the user to save this
// route to their personal database for future recall
//
    function (pixel,latlon,latlon_str) {
      if (!session)             return;
      var menu_direction = under_mouse_isa("route_directions");
      if (!menu_direction)         return;
      var map_marker = under_mouse_isa("map_marker");
      if (!map_marker)          return;
      if (!map_marker.metadata) return;
      if (map_marker.metadata.type != "waypoint") return;
      var opt={}; opt['Remove Waypoint'] = {
          onclick: function () { 
                        menuaction_directions_waypoint_remove(menu_direction,map_marker.metadata.waypoint_i) 
                    },
          icon: "css/images/icon-save.png"
      }; return opt; },

// --------------------------------------------------
// This should only be shown when right-clicking on a
// direction/route. This will allow the user to save this
// route to their personal database for future recall
//
    function (pixel,latlon,latlon_str) {
      if (!session)            return;
      menu_route = under_mouse_isa("route_directions");
      if (!menu_route)         return;
      var opt={}; opt['Save Directions'] = {
          onclick: menuaction_directions_save,
          icon: "css/images/icon-save.png"
      }; return opt; },

// --------------------------------------------------
// Load a previously modified route into the database
//
    function (pixel,latlon,latlon_str) {
      if (!session) return;
      var opt={}; opt['Load Directions'] = {
          onclick: menuaction_directions_load,
          icon: "css/images/icon-open.png"
      }; return opt; },

// --------------------------------------------------
// Request the service to start using the GPS to get location
// updates that will place the user on the map
//
    function (pixel,latlon,latlon_str) {
      if (!session) return;
      var opt={}; opt['Use GPS'] = {
          onclick: function () { gps_poll_pause = !gps_poll_pause; },
          icon: ( gps_poll_pause ? "css/images/cross.png" : "css/images/accept.png" )
      }; return opt; },

// --------------------------------------------------
// We can choose from multiple locations the source
// of our gps data. We may want to load from the server 
// where we store data or locally if we're finding that we're
// going offline for a bit.
//
    function (pixel,latlon,latlon_str) {
      if ( !session ) return;
      var opt={}; opt['Configure GPS'] = {
          onclick: menuaction_gps_configure
      }; return opt; },

// --------------------------------------------------
// Sometimes, the connection to the GPS will fail. Here,
// we can ask the system to renegotiate the connection
//
    function (pixel,latlon,latlon_str) {
      if ( gps_poll_pause ) return;
      var opt={}; opt['Reset GPS'] = {
          onclick: function () { jQuery.getJSON( '/gps_restart.json', {}, function () {}) },
      }; return opt; },

// --------------------------------------------------
// Do we want the map to center on the GPS? With this
// turned on, the map will recenter on the GPS' location
// with every update
//
    function (pixel,latlon,latlon_str) {
      if ( gps_poll_pause ) return;
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
// Request an API key for the user (which will allow for
// things such as gps updates)
//
    function (pixel,latlon,latlon_str) {
      if (!session) return;
      var opt={}; opt['API Key'] = {
          onclick: menuaction_api_key,
      }; return opt; },


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
 ***************************************************
 * INITIALIZATION
 ***************************************************
 ***************************************************/
$(function(){

// Check if the user's already logged in
    login_status_check();

// JQuery UI settings
//  $('#map_canvas').contextMenu(
//    contextmenu_event_show,
//    {theme:'vista'}
//  );

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

// Bind the right click to something useful
      GEvent.addListener(map,"singlerightclick",function(point,src,overlay){ 

// Account for when we're floating over something        
      if ( under_mouse.length > 0 ) {
      }

      var cmenu = $.contextMenu.create(contextmenu_event_show,{theme:"vista"});
      point.pageX = point.x;
      point.pageY = point.y;
      cmenu.show($('#map_canvas'),point);
    });

// Create a map and let's try and center it...
    var map_center = new GLatLng(CFG["defaults"]["map_center"][0],
                                 CFG["defaults"]["map_center"][1]);
    map.setCenter(map_center,CFG["defaults"]["map_zoom"]);
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

function login_status_check () {
// --------------------------------------------------
// If the user hits "reload" this will clear the
// "session" global. We want to see if the user is
// actually logged in (via cookies) still
//
    $.getJSON(
        'actions/session.json',
        {},
        function (data) {
            session   = data.sess;
            user_info = data.user;
        }
    );
}

function track_load ( trk_id ) {
// --------------------------------------------------
// Loads a particular track onto the current map
// 
    $.getJSON(
      'actions/track.json',
      {
        a: "get",
        trk_id: trk_id
      },
      function (data) {
        route = new route_directions({ 
                        map: map,
                        callback: function (me) { me.show(); }
                    });
        route.unserialize(data.trk_data);
        route.show();
      }
    );
}

/***************************************************
 * EVENTS
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

console.log("checking again");
// Should only be used while the streetview is updating to a new location
    if ( gps_poll_pause ) {
        return;
    };

console.log("LAST was: " + tics_last );
// We don't want to double up requests so we will wait 1 second before
// issuing a new request if it hung
    if ( tics_last && ( now.getTime() - 1000 < tics_last.getTime() ) ) {
        return;
    }

// Record that we're starting a new request.
    tics_last = now;

    data["a"] = "last";
    jQuery.ajax({
        type: "GET",
        url: "/actions/gps.json", 
        dataType: "json",
        data: data, 
        success: function ( data ) {
        // --------------------------------------------------
        // Receive the current status of the HMD and distance
        // travelled on the bike.
        //
            if ( data.error ) return;

        // Remove envelope
            data = data["data"];

console.log(data);
console.log("location update: " + data["gps_lat"] + " and " + data["gps_lon"] );
            if ( isNaN(data.gps_lat) || isNaN(data.gps_lon) ) {
                return;
            }

console.log("here");
            var new_position = new GLatLng( data.gps_lat, data.gps_lon );

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
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            console.log( XMLHttpRequest );
            console.log( textStatus ); 
            console.log( errorThrown );
        }
    });
}

/***************************************************
 * DIALOG FUNCTIONS
 ***************************************************/

function dialog_load ( title, page ) {
// --------------------------------------------------
// Load the appropriate dialog into the space
//
  $('#dialog').load(
                    "dialogs/"+page,
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

function menuaction_overlays() {
// --------------------------------------------------
    dialog_load('Overlays','dialog-overlays.phtml');
}


function menuaction_login () {
// --------------------------------------------------
    dialog_load('Login','dialog-login.phtml');
}

function menuaction_search () {
// --------------------------------------------------
    dialog_load('Login','dialog-search.phtml');
}

function menuaction_logout () {
// --------------------------------------------------
    dialog_load('Logout','dialog-logout.phtml');
}

function menuaction_directions (menu_item,menu) {
// --------------------------------------------------
    dialog_load('Location Search','dialog-directions.phtml');
}

function menuaction_directions_save (menu_item,menu) {
// --------------------------------------------------
    dialog_load('Direction Save','dialog-directions-save.phtml');
}

function menuaction_directions_load (menu_item,menu) {
// --------------------------------------------------
    dialog_load('Direction Load','dialog-directions-load.phtml');
}

function menuaction_directions_waypoint_remove ( route_directions, waypoint_i ) {
// --------------------------------------------------
    route_directions.waypoint_remove(waypoint_i);
    route_directions.search();
}

function menuaction_gps_configure (menu_item,menu) {
// --------------------------------------------------
    dialog_load('GPS Settings','dialog-gps-configure.phtml');
}

function menuaction_directions_here (menu_item,menu) {
// --------------------------------------------------
  alert(menu_item);
}

function menuaction_place_waypoint(menu_item,menu) {
// --------------------------------------------------
  alert(menu_item);
}


function menuaction_api_key (menu_item,menu) {
// --------------------------------------------------
    dialog_load('API Key','dialog-api-key.phtml');
}

/***************************************************
 * SETTINGS
 ***************************************************/

function settings_load () {
// --------------------------------------------------
// Load all the settings associated with a user
//
    jQuery.getJSON(
        '/actions/settings.json',
        { a: "list" },
        function (resp) {
        // --------------------------------------------------
            if ( resp.error ) return;
            var settings_loop = resp.data;
            for ( var i in settings_loop ) {
                settings[i] = settings_loop[i];
            }
        }
    );
}

function setting_save ( set_name, set_data ) {
// --------------------------------------------------
// Save a single setting value
//
    jQuery.getJSON(
        '/actions/settings.json',
        { 
            a: "set" ,
            set_name: set_name,
            set_data: set_data
        },
        function (resp) {
        // --------------------------------------------------
            if ( resp.error ) return;
            settings[set_name] = set_data;
        }
    );
}

/***************************************************
 * DEBUGGING
 ***************************************************/

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

