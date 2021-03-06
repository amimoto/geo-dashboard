package Geo::Dashboard::User;

use strict;
use Geo::Dashboard;
use Geo::Dashboard::DB;

sub user_init {
# --------------------------------------------------
# Load's the associated user's UDB object and SESSION
# object as required
#
    my ( $pkg, $sess_key ) = @_;

# Figure out who this user is from their session
    my $session = $SESS = $pkg->session_get({sess_key=>$sess_key}) or return;
    return $session unless my $user = $session->{ses_data}{user};

# Load up the user's database (create, if it doesn't exist)
    require Geo::Dashboard::DB;
    $UDB = Geo::Dashboard::DB->user_db_init($user->{usr_login});

# Done!
    return $session;
}

sub api_init {
# --------------------------------------------------
# Initialize the user via the api key
#
    my ( $pkg, $api_key ) = @_;

# Figure out who this user is from their session
    my $session = $SESS = $pkg->session_get({sess_key=>$api_key}) or return;
    return $session unless my $user = $session->{ses_data}{user};

# Load up the user's database (create, if it doesn't exist)
    require Geo::Dashboard::DB;
    $UDB = Geo::Dashboard::DB->user_db_init($user->{usr_login});

# Done!
    return $session;
}

sub user_get {
# --------------------------------------------------
# Fetches a user record from the database
#
    my ( $pkg, $args ) = @_;
    $args->{usr_login} or return;
    my $db = Geo::Dashboard::DB::db();
    my $user = $db->selectrow_hashref('select * from geod_users where usr_login = ?',{},$args->{usr_login});
    return $user;
}

sub user_add {
# --------------------------------------------------
# Create a new user in the database if possible
#
    my ( $pkg, $args ) = @_;
    $args->{usr_pass}  or return;
    $args->{usr_login} or return;

# Sanity check
    $args = {%$args}; # since we clobber
    $args->{usr_status} ||= 1;
    $args->{usr_pass} = $pkg->pass_crypt($args->{usr_pass});

# User find check
    my $db = Geo::Dashboard::DB::db();
    my $user_find = $db->prepare('select * from geod_users where usr_login = ?') or die $DBI::errstr;
    $user_find->execute($args->{usr_login}) or die $DBI::errstr;
    my $user = $user_find->fetchrow_hashref;

# If the user exists, we'll just do an update
    if ( ref $user ) {
        my $upd_query = $db->prepare(q`
            update geod_users 
            set usr_pass = ?, usr_status = ? 
            where usr_login = ? 
        `) or die $DBI::errstr;
        $upd_query->execute(@$args{qw( usr_pass usr_status usr_login )}) or die $DBI::errstr;

    }

# The user doesn't exist yet, so we'll do an insert
    else {
        my $ins_query = $db->prepare(q`
            insert into geod_users (
                                    usr_login,
                                    usr_pass,
                                    usr_status
                                ) 
                                values (
                                    ?,
                                    ?,
                                    ?
                                )
        `) or die $DBI::errstr;
        $ins_query->execute(@$args{qw( usr_login usr_pass usr_status )}) or die $DBI::errstr;

# Figure out the new user id
        $user_find->execute($args->{usr_login}) or die $DBI::errstr;
        $user = $user_find->fetchrow_hashref;

    }

    return $user->{usr_id};
}

sub user_list { 
# --------------------------------------------------
# Just return a list of all the users. Whee
#
    my $db = Geo::Dashboard::DB::db();
    my $user_query = $db->prepare('select * from geod_users order by usr_login') or die $DBI::errstr;
    $user_query->execute;
    my $user_list = $user_query->fetchall_arrayref({}) or die $DBI::errstr;
    return $user_list;

}

sub user_delete {
# --------------------------------------------------
# Remove a user from the database
#
    my ( $pkg, $args ) = @_;
    my $db = Geo::Dashboard::DB::db();
    my $usr_login = $args->{usr_login} or return;
    my $user_del = $db->prepare('delete from geod_users where usr_login = ?') or die $DBI::errstr;
    $user_del->execute($usr_login) or die $DBI::errstr;
    return 1;
}

sub user_login {
# --------------------------------------------------
# Logs a user into the system by validating that 
# the authenitcation credentials are correct then
# creating a new session for the user
# Requires:
#   @param: usr_login 
#   @param: usr_pass
#
    my ( $pkg, $args ) = @_;

# Can we find the user's account?
    my $user = $pkg->user_get($args) or return;

# Check the auth
    my $pass = $pkg->pass_crypt($args->{usr_pass},$user->{usr_pass});
    unless ( $pass eq $user->{usr_pass} ) {
        return;
    }

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

sub pass_crypt {
# --------------------------------------------------
    my ( $pkg, $pass, $salt ) = @_;

# Pull salt out if available
    if ( $salt ) {
        $salt =~ /^(.*)\$/;
        $salt = $1;
    }
# Create the salt if required
    else {
        my @chars = ('a'..'z','A'..'Z','0'..'9');
        $salt = join "", map { $chars[rand(0+@chars)] } (1..5);
    }

# Now generate the hashed key
    require Digest::MD5;
    my $pass = $salt . "\$" . Digest::MD5::md5_hex($salt.$pass);

    return $pass;
}

1;
