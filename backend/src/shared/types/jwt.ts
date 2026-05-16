export interface JwtPayload {
  sub: string      // userId
  tenantId: string
  slug: string
  role: string
  email: string
  name: string
}
