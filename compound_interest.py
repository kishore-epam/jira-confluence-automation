from decimal import Decimal, localcontext


def main():
    principal = Decimal("15847")
    annual_rate = Decimal("0.0734")
    compounds_per_year = 12
    total_months = 8 * 12 + 7

    with localcontext() as context:
        context.prec = 40
        final_amount = principal * (
            1 + annual_rate / compounds_per_year
        ) ** total_months
        total_interest = final_amount - principal

        print(f"Principal: ${principal:,.2f}")
        print(f"Annual rate: {annual_rate:.2%}")
        print(f"Compounding: monthly for {total_months} months")
        print(f"Final amount: ${final_amount:,.2f}")
        print(f"Total interest: ${total_interest:,.2f}")


if __name__ == "__main__":
    main()
