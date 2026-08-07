import { z } from 'zod';

export const createAccountSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  initialBalance: z.number().int().nonnegative('Initial balance must be non-negative integer').default(0),
});

export type CreateAccountDto = z.infer<typeof createAccountSchema>;

export const accountBalanceSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  balance: z.number().int(),
  updatedAt: z.date().or(z.string()),
});

export type AccountBalanceDto = z.infer<typeof accountBalanceSchema>;

export const transferRequestSchema = z.object({
  fromAccountId: z.string().uuid('Invalid source account ID'),
  toAccountId: z.string().uuid('Invalid destination account ID'),
  amount: z.number().int().positive('Transfer amount must be positive integer'),
  idempotencyKey: z.string().min(1, 'Idempotency key is required'),
}).refine((data) => data.fromAccountId !== data.toAccountId, {
  message: 'Cannot transfer to the same account',
  path: ['toAccountId'],
});

export type TransferRequestDto = z.infer<typeof transferRequestSchema>;

export const TransactionEntryTypeEnum = z.enum(['DEBIT', 'CREDIT']);
export type TransactionEntryType = z.infer<typeof TransactionEntryTypeEnum>;

export const transactionEntrySchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  type: TransactionEntryTypeEnum,
  amount: z.number().int().positive('Amount must be positive integer'),
});

export type TransactionEntryDto = z.infer<typeof transactionEntrySchema>;

export const domainEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string().min(1),
  version: z.string().default('1.0'),
  occurredAt: z.string().or(z.date()),
  payload: z.record(z.unknown()),
});

export type DomainEventDto = z.infer<typeof domainEventSchema>;

export const reconciliationStatusEnum = z.enum(['PASSED', 'FAILED']);
export type ReconciliationStatusType = z.infer<typeof reconciliationStatusEnum>;

export const reconciliationReportSchema = z.object({
  id: z.string().uuid(),
  executedAt: z.string().or(z.date()),
  totalAccountsChecked: z.number().int().nonnegative(),
  discrepanciesFound: z.number().int().nonnegative(),
  status: reconciliationStatusEnum,
  details: z.record(z.unknown()),
});

export type ReconciliationReportDto = z.infer<typeof reconciliationReportSchema>;
