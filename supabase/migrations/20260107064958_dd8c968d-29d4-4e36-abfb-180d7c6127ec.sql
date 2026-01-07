-- Drop the restrictive check constraint and allow any text for issue_type
ALTER TABLE over_limit_payments DROP CONSTRAINT over_limit_payments_issue_type_check;