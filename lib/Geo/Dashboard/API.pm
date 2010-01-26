package Geo::Dashboard::API;

use strict;
use Geo::Dashboard;
use Geo::Dashboard::DB;
our $COLS = [
    api_key              => { type => "varchar(100)", primary_key => 1, notnull => 1 },
    usr_id_fk            => { type => "integer", notnull => 1 },
    usr_login_fk         => { type => "varchar(100)", notnull => 1 },
    api_created_tics     => { type => "integer", notnull => 1 },
    api_expires          => { type => "integer", notnull => 1 },
    api_data             => { type => "text" },
];
our $COL_LOOKUP = {@$COLS};

sub api_login {
# --------------------------------------------------
# Logs a api into the system by validating that 
# the authenitcation credentials are correct then
# creating a new session for the api
# Requires:
#   @param: usr_login 
#   @param: usr_pass
#
    my ( $pkg, $args ) = @_;

# Can we find the api's account?
    my $api = $pkg->api_get($args) or return;

# Figure out who the user might be
    require Geo::Dashboard::User;
    my $user_login = $api->{usr_login_fk} or return;
    my $user = Geo::Dashboard::User->user_get({usr_login=>$user_login}) or return;

# Does the user already have a session?
    my $sess = $SESS = $pkg->session_get($args);
    if ( $sess ) {
        $sess->{user} = $user;
        $pkg->session_update($sess);
    }

# Create the session for the user!
    else {
        $sess = $pkg->session_allocate({user=>$user});
    }

# Load up the user's database (create, if it doesn't exist)
    require Geo::Dashboard::DB;
    $UDB = Geo::Dashboard::DB->user_db_init($user->{usr_login});

    return {
        user => $user,
        sess => $sess
    };
}

sub api_list {
# --------------------------------------------------
# Retreives a list of all the settings associated with
# a user
#
    my ( $pkg, $args ) = @_;
    return unless $DB;

# Now, get a list of the user's settings (that they've stored)
    my $api_sql = qq`select * from geod_api order by api_key`;
    my $api_sth = $DB->prepare($api_sql) or die $DBI::errstr;
    $api_sth->execute or die $DBI::errstr;
    my @api_list;
    while (my $track = $api_sth->fetchrow_hashref) {
        push @api_list, $track;
    }

    return \@api_list;
}

sub api_get {
# --------------------------------------------------
# Fetch the track based upon the ID or by the track's
# name.
#
    my ( $pkg, $args ) = @_;
    return unless $DB;
    my $fetch_sql = "select * from geod_api where ";

    if ( my $api_key = $args->{api_key} ) {
        return $DB->selectrow_hashref(
                        $fetch_sql."api_key=?",
                        {},
                        $args->{api_key}
                    ) or die $DBI::errstr;
    }

    elsif ( my $usr_login_fk = $args->{usr_login_fk} ) {
        return $DB->selectrow_hashref(
                        $fetch_sql."usr_name_fk=?",
                        {},
                        $args->{api_key}
                    ) or die $DBI::errstr;
    }

    return;
}

sub api_create {
# --------------------------------------------------
# Creates a new api key for a single user. The user_login
# MUST be provided
#
    my ( $pkg, $args ) = @_;
    $args->{usr_login_fk} or return;

# Does the user exist?
    require Geo::Dashboard::User;
    my $user_rec = Geo::Dashboard::User->user_get({usr_login=>$args->{usr_login_fk}}) or return;

# Find a free API key
    my $api_key;
    do {
        require Digest::MD5;
        $api_key = Digest::MD5::md5_hex(time*rand().$$);
    } while ( $pkg->api_get({api_key=>$api_key}) );

# Register it
    my $api_rec = $pkg->api_add({
                            api_key   => $api_key,
                            usr_id_fk => $user_rec->{usr_id},
                            usr_login_fk => $user_rec->{usr_login},
                        });

    return $api_key;
}

sub api_add {
# --------------------------------------------------
# Inserts a new entry into the user's track database
# We're not going to do anything fancy :)
#
    my ( $pkg, $args ) = @_;

    return unless $DB;
    return unless exists $args->{api_key} and $args->{api_key};

    $args->{api_created_tics} ||= time;
    $args->{api_expires}      ||= time + 60*60*24*356;

# Figure out what we're going to set 
    my ( @fields, @values );
    for my $k (keys %$COL_LOOKUP) {
        next if not defined $args->{$k};
        push @fields, $k;
        push @values, $args->{$k};
    }

# Make sure we have a track name
    my $api_key = $args->{api_key};

# Ensure we're not going to wipe out an existing entry
    if ( my $existing = $pkg->api_get({api_key=>$api_key}) ) {
        return;
    };

# Create the happy query
    my $add_sql = "insert into geod_api ("
                                            .join(",",@fields)
                                        .") values ("
                                            .join(",",map {"?"} @fields)
                                        .")";
    my $add_sth = $DB->prepare($add_sql) or die $DBI::errstr;
    $add_sth->execute(@values) or die $DBI::errstr;

# Now, return the new record
    return $pkg->api_get({api_key=>$api_key});
}

sub api_set {
# --------------------------------------------------
# Inserts a new entry into the user's track database
# We're not going to do anything fancy :)
#
    my ( $pkg, $args ) = @_;

    return unless $DB;
    return unless exists $args->{api_key} and $args->{api_key};

# Figure out what we're going to set 
    my ( @fields, @values );
    for my $k (keys %$COL_LOOKUP) {
        next if $COL_LOOKUP->{$k}{primary_key};
        next if not defined $args->{$k};
        push @fields, $k;
        push @values, $args->{$k};
    }

# Make sure we have a track name
    my $api_key = $args->{api_key};

# Remove the previous entry if there was one
    my $del_sth = $DB->prepare(qq`delete from geod_api where ( api_key = ? )`);
    $del_sth->execute($args->{api_key});

# Create the happy query
    my $add_sql = "insert into geod_api ("
                                            .join(",",@fields)
                                        .") values ("
                                            .join(",",map {"?"} @fields)
                                        .")";
    my $add_sth = $DB->prepare($add_sql) or die $DBI::errstr;
    $add_sth->execute(@values) or die $DBI::errstr;

# Now, return the new record
    return $pkg->api_get({api_key=>$api_key});
}

sub session_get {
# --------------------------------------------------
# Receive the key and return the associated key
#
    my ( $pkg, $args ) = @_;
    my $db = Geo::Dashboard::DB::db();
    my $sess_key = $args->{sess_key} or return;
    my $sess = $db->selectrow_hashref(q`select * from geod_sessions where ses_key = ?`,{},$sess_key) or return;
    require JSON;
    my $sess_data = JSON::from_json( $sess->{ses_data} );
    my $sess_info = {%$sess};
    $sess_info->{ses_data} = $sess_data;
    return $sess_info;
}

sub session_allocate {
# --------------------------------------------------
# Creates a new session, associates data and returns
# the new session key
#
    my ( $pkg, $data ) = @_;

# Get a unique session key
    my $db = Geo::Dashboard::DB::db();
    my $sess_key;
    require Digest::MD5;
    do {
        $sess_key = Digest::MD5::md5_hex(rand()*$$+time);
    } while ( $pkg->session_get({ sess_key => $sess_key }) );

# Create a new session
    require JSON;
    my $ses_data = JSON::to_json($data);
    my $ses_ins = $db->prepare(q`
                insert into geod_sessions 
                    (ses_key,ses_created_tics,ses_expires,ses_data) 
                values (?,?,?,?)`) or die $DBI::errstr;
    $ses_ins->execute($sess_key,time,time+60*60,$ses_data) or die $DBI::errstr;

    return $pkg->session_get({sess_key=>$sess_key});
}

sub session_update {
# --------------------------------------------------
# Updates the data on the current session
#
    my ( $pkg, $sess_info ) = @_;
    my $sess_key = $sess_info->{ses_key} or return;
    my $sess = session_get({sess_key=>$sess_key}) or return; # ensure session exists
    my $db = Geo::Dashboard::DB::db();
    my $sess_update = $db->prepare('update geod_sessions set ses_data=?,ses_expires=? where ses_key=?');
    require JSON;
    my $sess_data = JSON::to_json($sess_info->{ses_data});
    $sess_update->execute($sess_data,time+60*60,$sess_key) or die $DBI::errstr;
    return 1;
}

sub session_delete {
# --------------------------------------------------
# Removes a session from the database
#
    my ( $pkg, $args ) = @_;
    my $db = Geo::Dashboard::DB::db();
    my $sess_key = $args->{sess_key} or return;
    my $sess = $db->selectrow_hashref(q`delete from geod_sessions where ses_key = ?`,{},$sess_key) or return;
    return 1;
}


1;
