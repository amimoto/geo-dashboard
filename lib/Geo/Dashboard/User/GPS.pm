package Geo::Dashboard::User::GPS;

use strict;
use Geo::Dashboard;
use Geo::Dashboard::DB;
our $COLS = [
    gps_id               => { type => "integer", primary_key => 1 },
    gps_time             => { type => "float" },
    gps_lat              => { type => "float" },
    gps_lon              => { type => "float" },
    gps_alt              => { type => "float" },
    gps_speed            => { type => "float" },
    gps_hdop             => { type => "float" },
    gps_vdop             => { type => "float" },
    gps_heading          => { type => "float" },
    gps_fix              => { type => "int" },
    gps_data             => { type => "text" },
];
our $COL_LOOKUP = {@$COLS};

sub gps_list {
# --------------------------------------------------
# Retreives a list of all the gps data associated with
# a user
#
    my ( $pkg, $args ) = @_;
    return unless $UDB;

# Now, get a list of the user's gps (that they've stored)
    my $gps_sql = qq`select * from geodu_gps order by gps_time desc`;
    if ( my $limit = int $args->{limit}||0 ) {
        $gps_sql .= " limit " . $limit;
    }
    my $gps_sth = $UDB->prepare($gps_sql) or die $DBI::errstr;
    $gps_sth->execute or die $DBI::errstr;
    my @gps_list;
    while (my $track = $gps_sth->fetchrow_hashref) {
        push @gps_list, $track;
    }

    return \@gps_list;
}

sub gps_get {
# --------------------------------------------------
# Fetch the track based upon the ID or by the track's
# name.
#
    my ( $pkg, $args ) = @_;
    return unless $UDB;
    my $fetch_sql = "select * from geodu_gps where ";
    if ($args->{gps_time}) {
        return $UDB->selectrow_hashref(
                        $fetch_sql."gps_time=?",
                        {},
                        $args->{gps_time}
                    ) or die $DBI::errstr;
    }
    elsif ( $args->{set_id} ) {
        return $UDB->selectrow_hashref(
                        $fetch_sql."set_id=?",
                        {},
                        $args->{set_id}
                    ) or die $DBI::errstr;
    }
    return;
}

sub gps_add {
# --------------------------------------------------
# Inserts a new entry into the user's track database
# We're not going to do anything fancy :)
#
    my ( $pkg, $args ) = @_;

    return unless $UDB;
    return unless exists $args->{gps_time} and $args->{gps_time};

# Figure out what we're going to set 
    my ( @fields, @values );
    for my $k (keys %$COL_LOOKUP) {
        next if $COL_LOOKUP->{$k}{primary_key};
        next if not defined $args->{$k};
        push @fields, $k;
        push @values, $args->{$k};
    }

# Create the happy query
    my $add_sql = "insert into geodu_gps ("
                                            .join(",",@fields)
                                        .") values ("
                                            .join(",",map {"?"} @fields)
                                        .")";
    my $add_sth = $UDB->prepare($add_sql) or die $DBI::errstr;
    $add_sth->execute(@values) or die $DBI::errstr;

# Now, return the new record
    my $new_rec = $pkg->gps_get({gps_time=>$args->{gps_time}});
    return $new_rec;

}

1;

