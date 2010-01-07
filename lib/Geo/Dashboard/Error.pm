package Geo::Dashboard::Error;

use strict;
use Moose;

has 'errors' => ( is => "rw", isa => "ArrayRef", default => sub {[]});

sub e {
# --------------------------------------------------
# Add a new error to the database
#
    my ( $self, $message ) = @_;
    my $errors = $self->errors;
    push @$errors, $message;
    return;
}

sub has_errors {
# --------------------------------------------------
# Returns a true value if there are errors
#
    my ( $self ) = @_;
    my $errors = $self->errors;
    return 0+@$errors;
}

sub message {
# --------------------------------------------------
# Returns a stringified version of the last error
#
    my ( $self ) = @_;
    my $errors = $self->errors;
    return unless $self->has_errors;
    my $message = $errors->[-1];
    return $message;
}

1;
