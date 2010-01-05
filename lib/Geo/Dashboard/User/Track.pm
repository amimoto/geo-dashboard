package Geo::Dashboard::User::Track;

use strict;
use Geo::Dashboard;
use Geo::Dashboard::DB;
our $COLS = [
    trk_id           => { type => "integer", "primary_key" => 1, "autoincrement" => 1},
    trk_name         => { type => "varchar(255)" },
    trk_created      => { type => "integer" },
    trk_bound_sw_lat => { type => "float" },
    trk_bound_sw_lon => { type => "float" },
    trk_bound_ne_lat => { type => "float" },
    trk_bound_ne_lon => { type => "float" },
    trk_description  => { type => "text" },
    trk_data         => { type => "text" },
];
our $COL_LOOKUP = {@$COLS};

sub track_list {
# --------------------------------------------------
# Retreives a list of all the tracks associated with
# a user
#
    my ( $pkg, $args ) = @_;
    return unless $UDB;

# Now, get a list of the user's tracks (that they've stored)
    my $track_sql = qq`select * from geodu_track order by trk_name`;
    my $track_sth = $UDB->prepare($track_sql) or die $DBI::errstr;
    $track_sth->execute or die $DBI::errstr;
    my @track_list;
    while (my $track = $track_sth->fetchrow_hashref) {
        push @track_list, $track;
    }

    return \@track_list;
}

sub track_get {
# --------------------------------------------------
# Fetch the track based upon the ID or by the track's
# name.
#
    my ( $pkg, $args ) = @_;
    return unless $UDB;
    my $fetch_sql = "select * from geodu_track where ";
    if ($args->{trk_name}) {
        return $UDB->selectrow_hashref($fetch_sql."trk_name=?",$args->{trk_name}) or die $DBI::errstr;
    }
    elsif ( $args->{trk_id} ) {
        return $UDB->selectrow_hashref($fetch_sql."trk_id=?",$args->{trk_id}) or die $DBI::errstr;
    }
    return
}

sub track_add {
# --------------------------------------------------
# Inserts a new entry into the user's track database
# We're not going to do anything fancy :)
#
    my ( $pkg, $args ) = @_;
    return unless $UDB;

# Figure out what we're going to set 
    my ( @fields, @values );
    for my $k (keys %$COL_LOOKUP) {
        next if $COL_LOOKUP->{$k}{primary_key};
        next if not defined $args->{$k};
        push @fields, $k;
        push @values, $args->{$k};
    }

# Create the happy query
    my $add_sql = "insert into geodu_waypoints (".join(",",@fields).")".join(",",map {"?"} @fields);
    my $add_sth = $UDB->prepare($add_sql) or die $DBI::errstr;
    $add_sth->execute(@values) or die $DBI::errstr;

# Now, return the new record
    return $pkg->track_get($args);
}

1;

