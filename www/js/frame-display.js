/*
 * Initialization
 */

var map;
var geocoder;
var directions;

var overlays_toggled = {};
var menu1 = [ 
    null, // used to show what the location is
    $.contextMenu.separator, 
    { 'Directions from here': menuaction_directions_here },
    { 'Directions to here':   menuaction_directions_here },
    { 'Place Waypoint':       menuaction_place_waypoint  } 
  ]; 

$(function() {
  window_event_resize();
  window.onresize = window_event_resize;

// Menus      
  $('#map_canvas').contextMenu(
    function (cmenu,t,e) {
      var pixel = new GPoint(e.pageX, e.pageY);
      var latlon = map.fromContainerPixelToLatLng(pixel);
      var latlon_str = sprintf( "%.05f,%.05f", latlon.lng(), latlon.lat() );
      var option_first = {};
      option_first[latlon_str] = function(menuItem,menu) {  window.prompt("Location Coordinates (longitude,latitude)",latlon.lng()+","+latlon.lat())};
      menu1[0] = option_first;
      return menu1;
    },
    {theme:'vista'}
  );

// Setup the map view
  if (GBrowserIsCompatible()) {
    map        = new GMap2(document.getElementById("map_canvas"));
    geocoder   = new GClientGeocoder();
    directions = new GDirections( map );
    map.setCenter(new GLatLng(CFG["defaults"]["map_center"][0],CFG["defaults"]["map_center"][1]),CFG["defaults"]["map_zoom"]);
    map.setUIToDefault();
  };

});

/*
 * Actions
 */

function direction_search ( dir_a, dir_b, dir_type ) {
// --------------------------------------------------
// Seek direction information based upon the A, B, and
// type fields
//
    var map = top.display.map;
    directions.load("from: " + dir_a + " to: " + dir_b );
}


/*
 * Event Handling
 */

function window_event_resize () {
// --------------------------------------------------
  $('.fill_page').css("width",window.innerWidth)
                 .css("height",window.innerHeight);
}

/*
 * Menu Functions
 */

function menuaction_directions_here (menu_item,menu) {
// --------------------------------------------------
  alert(menu_item);
}

function menuaction_place_waypoint(menu_item,menu) {
// --------------------------------------------------
  alert(menu_item);
}

/*
 * Basic Functions
 */


function overlay_toggle ( overlay_name ) {
// --------------------------------------------------
// Turns on and off overlays on the map
//

// Turn off?
  if ( overlays_toggled[overlay_name] ) {
    var overlay = overlays_toggled[overlay_name];
    overlays_toggled[overlay_name] = null;
    map.removeOverlay(overlay);
  }

// Turn on
  else {
    var overlay;
    if ( overlay_name == "streetview" ) {
        overlay = new GStreetviewOverlay();
    }
    else if ( overlay_name == "wikipedia" ) {
        overlay = new GLayer("org.wikipedia.en");
    }
    else if ( overlay_name == "panoramio" ) {
        overlay = new GLayer("com.panoramio.all");
    }
    else if ( overlay_name == "webcams" ) {
        overlay = new GLayer("com.google.webcams");
    }
    if ( overlay ) {
      overlays_toggled[overlay_name] = overlay;
      map.addOverlay(overlay);
    }
  }
}

