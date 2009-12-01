/*
 * Initialization
 */

var search_query_i = 0;
var search_queries = [];
var search_query_lookup = {};
var tpl_search_previous_entry = '<li id="search-location-{{search_location_id}}">'
                                  + '<a href="#" onclick="return search_location_load(null,\'{{search_location_esc}}\')">'
                                    +'{{search_location}}'
                                  + '</a>'
                                  + ' <sup>['
                                    + '<a href="#" onclick="return search_location_delete(\'{{search_location_id}}\')">'
                                      +'Delete'
                                    + '</a>'
                                  + ']</sup> '
                                + '</li>';
var overlays_toggled = {};

$(function(){
  $("#accordion").accordion({ header: "h3", autoHeight: false });
});

/*
 * Event Handling
 */

function search_location_submit ( form ) {
// --------------------------------------------------
// Use the data in search_location form to query 
// where such and such a location might be
//
  var search_location = form.search_location.value;
  var geocoder        = top.display.geocoder;
  var map             = top.display.map;

// Clear previous errors
  $('#search-error').hide();

  if ( !geocoder ) return false; // need to wait till the main page loads

  geocoder.getLatLng( 
    search_location, 
    function(point){ search_location_load(point,search_location) }
  );

  return false;
}

function search_location_load ( point, search_location ) {
// --------------------------------------------------

// Load from cache if we can
  if (!point && search_query_lookup[search_location]) {
    point = search_query_lookup[search_location][0];
  };

// No point, we'll just throw an error
  if (!point) {
    $('#search-error-message').html(search_location+"not found");
    $('#search-error').slideDown();
    return false;
  }

// Clear the search toolbar
    $('#search_location').val('');

// Add the entry to the search lookup if it doesn't already exist
  var map = top.display.map;

  if ( search_query_lookup[search_location] == null ) {

// Append to list 
    search_query_i++;
    point = new GLatLng( point.lat(), point.lng() );
    search_query_lookup[search_location] = [ point, search_query_i ];
    search_queries.push( [ search_location, point, search_query_i  ] );

// Append the search to the dropdown that lists all the entries
    $('#search-previous').slideDown();
    $('#search-previous-list').append($.tempest( 
      tpl_search_previous_entry,
      { 
        "search_location": search_location,
        "search_location_esc": quotemeta(search_location),
        "search_location_id": search_query_i
      }
    ));

// Put a small marker over the point found
    var marker = new GMarker(point);
    map.addOverlay(marker);
    marker.openInfoWindowHtml(search_location);
  }

// Move the map
  map = top.display.map;
  map.setCenter(point, 14);

  return false;
}

function search_location_delete ( search_location_id ) {
// --------------------------------------------------
// Removes the listed search location from the entries
//
 
// Iterate through and remove the location that matches
    var search_queries_new = [];
    for ( var i in search_queries ) {
      var v = search_queries[i];
      if (v[2]==search_location_id) continue;
      search_queries_new.push(v);
    }
    search_queries = search_queries_new;

// Remove the text that shows the entry
    $('#search-location-'+search_location_id).remove();

// If there are no elements in the cache, we'll remove 
// the list that shows all the historic searches
    if ( search_queries.length == 0 ) {
      $('#search-previous').slideUp();
    }


// Remove the records from the lookup 
    var search_query_lookup_new = [];
    for ( var i in search_query_lookup ) {
      if (i[1]==search_location_id) continue;
      search_query_lookup_new[i] = search_query_lookup[i];
    }
    search_query_lookup = search_query_lookup_new;

}

function direction_search ( dir_a, dir_b, dir_type ) {
// --------------------------------------------------
// Seek direction information based upon the A, B, and
// type fields
//
    top.display.direction_search(dir_a,dir_b);
}

/********************************************
 * LOGIN LOGOUT
 ********************************************/

function account_login ( user, pass ) {
// --------------------------------------------------
// Attempt to login to the remote server
//
}

function account_logout () {
// --------------------------------------------------
// Logout from remote server
//
}

/********************************************
 * INTERFACE ELEMENTS
 ********************************************/

function overlay_toggle ( overlay_name ) {
// --------------------------------------------------
// Turns on and off overlays on the map
//

  var map = top.display.map;

// Turn off?
  var div_id = "#overlay-" + overlay_name;
  if ( overlays_toggled[overlay_name] ) {
    $(div_id + " span").removeClass('ui-icon-check')
                       .addClass('ui-icon-radio-on');
    overlays_toggled[overlay_name] = null;
    top.display.overlay_toggle(overlay_name);
  }

// Turn on
  else {
    overlays_toggled[overlay_name] = 1;
    $(div_id + " span").removeClass('ui-icon-radio-on')
                       .addClass('ui-icon-check');
    top.display.overlay_toggle(overlay_name);
  }
}

