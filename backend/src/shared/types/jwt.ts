export interface JwtPayload {
  sub: string      // userId
  tenantId: string
  role: string
  email: string
  name: string
}
