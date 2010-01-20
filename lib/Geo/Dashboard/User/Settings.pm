package Geo::Dashboard::User::Settings;

use strict;
use Geo::Dashboard;
use Geo::Dashboard::DB;
our $COLS = [
    set_id           => { type => "integer", "primary_key" => 1, "autoincrement" => 1},
    set_name         => { type => "varchar(255)" },
    set_data         => { type => "text" },
];
our $COL_LOOKUP = {@$COLS};

sub setting_list {
# --------------------------------------------------
# Retreives a list of all the settings associated with
# a user
#
    my ( $pkg, $args ) = @_;
    return unless $UDB;

# Now, get a list of the user's settings (that they've stored)
    my $setting_sql = qq`select * from geodu_settings order by set_name`;
    my $setting_sth = $UDB->prepare($setting_sql) or die $DBI::errstr;
    $setting_sth->execute or die $DBI::errstr;
    my @setting_list;
    while (my $track = $setting_sth->fetchrow_hashref) {
        push @setting_list, $track;
    }

    return \@setting_list;
}

sub setting_get {
# --------------------------------------------------
# Fetch the track based upon the ID or by the track's
# name.
#
    my ( $pkg, $args ) = @_;
    return unless $UDB;
    my $fetch_sql = "select * from geodu_settings where ";
    if ($args->{set_name}) {
        return $UDB->selectrow_hashref(
                        $fetch_sql."set_name=?",
                        {},
                        $args->{set_name}
                    ) or die $DBI::errstr;
    }
    elsif ( $args->{set_id} ) {
        return $UDB->selectrow_hashref(
                        $fetch_sql."set_id=?",
                        {},
                        $args->{set_id}
                    ) or die $DBI::errstr;
    }
    return
}

sub setting_add {
# --------------------------------------------------
# Inserts a new entry into the user's track database
# We're not going to do anything fancy :)
#
    my ( $pkg, $args ) = @_;

    return unless $UDB;
    return unless exists $args->{set_name} and $args->{set_name};

# Figure out what we're going to set 
    my ( @fields, @values );
    for my $k (keys %$COL_LOOKUP) {
        next if $COL_LOOKUP->{$k}{primary_key};
        next if not defined $args->{$k};
        push @fields, $k;
        push @values, $args->{$k};
    }

# Make sure we have a track name
    my $set_name = $args->{set_name};

# Ensure we're not going to wipe out an existing entry
    if ( my $existing = $pkg->setting_get({set_name=>$set_name}) ) {
        return;
    };

# Create the happy query
    my $add_sql = "insert into geodu_settings ("
                                            .join(",",@fields)
                                        .") values ("
                                            .join(",",map {"?"} @fields)
                                        .")";
    my $add_sth = $UDB->prepare($add_sql) or die $DBI::errstr;
    $add_sth->execute(@values) or die $DBI::errstr;

# Now, return the new record
    return $pkg->setting_get({set_name=>$set_name});
}

sub setting_set {
# --------------------------------------------------
# Inserts a new entry into the user's track database
# We're not going to do anything fancy :)
#
    my ( $pkg, $args ) = @_;

    return unless $UDB;
    return unless exists $args->{set_name} and $args->{set_name};

# Figure out what we're going to set 
    my ( @fields, @values );
    for my $k (keys %$COL_LOOKUP) {
        next if $COL_LOOKUP->{$k}{primary_key};
        next if not defined $args->{$k};
        push @fields, $k;
        push @values, $args->{$k};
    }

# Make sure we have a track name
    my $set_name = $args->{set_name};

# Remove the previous entry if there was one
    my $del_sth = $UDB->prepare(qq`delete from geodu_settings where ( set_name = ? )`);
    $del_sth->execute($args->{set_name});

# Create the happy query
    my $add_sql = "insert into geodu_settings ("
                                            .join(",",@fields)
                                        .") values ("
                                            .join(",",map {"?"} @fields)
                                        .")";
    my $add_sth = $UDB->prepare($add_sql) or die $DBI::errstr;
    $add_sth->execute(@values) or die $DBI::errstr;

# Now, return the new record
    return $pkg->setting_get({set_name=>$set_name});
}
1;

