export type UserRole = 'BUSINESS_OWNER' | 'LEC7_ADMIN' | 'RECEIVER'
export type AuthRole = UserRole | 'visitor'
export type RequestStatus = 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED'
export type DocumentType = 'INVOICE_PDF' | 'CONTRACT' | 'OTHER'

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: UserRole
  businessId?: string
}
