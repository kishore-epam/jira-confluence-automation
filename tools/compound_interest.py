r"""Calculate compound interest: python tools\compound_interest.py 1000 5 12 2.5."""

import argparse
from decimal import Decimal, DecimalException, InvalidOperation, localcontext


def nonnegative_decimal(value: str) -> Decimal:
    try:
        number = Decimal(value)
    except InvalidOperation:
        raise argparse.ArgumentTypeError("must be a valid number") from None
    if not number.is_finite() or number < 0:
        raise argparse.ArgumentTypeError("must be a finite, nonnegative number")
    return number


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Calculate compound interest without intermediate rounding.",
        epilog="Example: %(prog)s 1000 5 12 2.5",
    )
    parser.add_argument("principal", type=nonnegative_decimal, help="initial amount")
    parser.add_argument(
        "annual_rate", type=nonnegative_decimal, help="annual percentage rate (e.g. 7.34)"
    )
    parser.add_argument(
        "compounds_per_year", type=int, help="positive integer compounding frequency"
    )
    parser.add_argument(
        "total_years", type=nonnegative_decimal, help="duration in years (may be fractional)"
    )
    args = parser.parse_args()
    if args.compounds_per_year <= 0:
        parser.error("compounds_per_year must be a positive integer")

    try:
        with localcontext() as context:
            context.prec = 40
            final_amount = args.principal * (
                1 + args.annual_rate / 100 / args.compounds_per_year
            ) ** (args.compounds_per_year * args.total_years)
            interest_earned = final_amount - args.principal
            print(f"Final amount: ${final_amount:,.2f}")
            print(f"Interest earned: ${interest_earned:,.2f}")
    except DecimalException as error:
        parser.error(f"calculation exceeds supported numeric limits ({type(error).__name__})")


if __name__ == "__main__":
    main()
