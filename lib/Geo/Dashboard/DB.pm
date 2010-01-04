package Geo::Dashboard::DB;

use strict;
use DBI;
use Geo::Dashboard;

sub db { 
# --------------------------------------------------
# This db accesses the global store for information, holding
# information such as user accounts and bookmarks
#
    return $Geo::Dashboard::DB ||= do {
        DBI->connect(
            "dbi:SQLite:dbname=$CFG->{paths}{base}/$CFG->{database}{db_path}/$CFG->{database}{db_fname}",
            '',
            ''
        );
    };
}

sub user_db {
# --------------------------------------------------
# This db accesses the personal store for information, holding
# information such as user's personal tracks and waypoints
#
    my ( $user_id ) = @_;
    return unless $user_id =~ /^\w+$/; 
        DBI->connect(
            "dbi:SQLite:dbname=$CFG->{paths}{base}/$CFG->{database}{db_fpath}",
            '',
            ''
        );

}

sub db_init {
# --------------------------------------------------
# Initializes are the required tables in the database
#
    my $db = db();

# Create all the tables! Yay!
    for my $sql (

        qq`
            create table if not exists geod_users (
                usr_id integer primary key autoincrement,
                usr_login varchar(100) not null,
                usr_pass varchar(100) not null,
                usr_status int not null
            )
        `,

        qq`
            create table if not exists geod_sessions (
                ses_key varchar(100) not null primary key,
                ses_created_tics integer not null,
                ses_expires integer not null,
                ses_data text
            )
        `,


    ) {
        my $sth = $db->prepare($sql) or die $DBI::errstr;
        $sth->execute or die $DBI::errstr;
    }
}

sub user_db_init {
# --------------------------------------------------
# Initializes are the required tables in a user's database
#
    my $udb = user_db();

# Create all the tables! Yay!
    for my $sql (

        qq`
            create table if not exists geodu_track (
                trk_id integer autoincrement primary key,
                trk_name varchar(255),
                trk_bound_sw_lat float,
                trk_bound_sw_lon float,
                trk_bound_ne_lat float,
                trk_bound_ne_lon float,
                trk_description text,
                trk_data text
            )
        `,

        qq`
            create table if not exists geodu_waypoint (
                wpt_id integer autoincrement primary key,
                wpt_name varchar(255),
                wpt_description text,
                wpt_lat float,
                wpt_lon float,
                wpt_alt float,
                wpt_radius float
            )
        `,

    ) {
        my $usth = $udb->prepare($sql) or die $DBI::errstr;
        $usth->execute or die $DBI::errstr;
    }
}



1;
