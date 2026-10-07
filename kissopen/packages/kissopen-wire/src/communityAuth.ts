import { z } from 'zod';

export const CommunityProviderSchema = z.enum(['github', 'google', 'nodeloc']);
export type CommunityProvider = z.infer<typeof CommunityProviderSchema>;
export const CommunityProfileSchema = z.object({
    id: z.string(), provider: CommunityProviderSchema, name: z.string(), username: z.string().nullable().optional(),
});
export type CommunityProfile = z.infer<typeof CommunityProfileSchema>;
export const CommunityProvidersSchema = z.object({ providers: z.array(CommunityProviderSchema) });
export const CommunityStartRequestSchema = z.object({ provider: CommunityProviderSchema });
export const CommunityStartResponseSchema = z.object({
    id: z.string(), pollToken: z.string(), authorizationUrl: z.string().url(), expiresAt: z.string(),
});
export const CommunityLoginHandleSchema = CommunityStartResponseSchema.omit({ authorizationUrl: true });
export const CommunityPasswordRequestSchema = z.object({
    username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/),
    password: z.string().min(1).max(128),
});
export const CommunityFactorRequestSchema = z.object({ code: z.string().trim().min(6).max(64) });
export const CommunityStatusSchema = z.discriminatedUnion('status', [
    z.object({ status: z.literal('pending') }),
    z.object({ status: z.literal('second_factor') }),
    z.object({ status: z.literal('linked') }),
    z.object({ status: z.literal('failed'), message: z.string() }),
    z.object({ status: z.literal('authorized'), profile: CommunityProfileSchema,
        challenge: z.string(), workspacePublicKey: z.string().nullable() }),
]);
export const CommunityCompleteRequestSchema = z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('identity') }),
    z.object({ mode: z.literal('workspace'), publicKey: z.string(), signature: z.string() }),
]);
export const CommunityCompleteResponseSchema = z.object({
    profile: CommunityProfileSchema, token: z.string(), workspaceToken: z.string().optional(),
});

export const CommunitySecuritySchema = z.object({
    username: z.string().nullable(), passwordEnabled: z.boolean(), totpEnabled: z.boolean(),
    recoveryCodesRemaining: z.number().int().nonnegative(),
    providers: z.array(z.object({ provider: CommunityProviderSchema, configured: z.boolean(), linked: z.boolean() })),
});
export const CommunityVerifyRequestSchema = z.object({ password: z.string().max(128).optional(), code: z.string().max(64).optional() });
export const CommunityProofSchema = z.object({ proof: z.string() });
export const CommunityUsernameRequestSchema = CommunityProofSchema.extend({ username: CommunityPasswordRequestSchema.shape.username });
export const CommunityPasswordChangeSchema = CommunityProofSchema.extend({ password: z.string().min(12).max(128) });
export const CommunityTotpSetupSchema = z.object({ setupToken: z.string(), secret: z.string(), uri: z.string() });
export const CommunityTotpConfirmSchema = z.object({ setupToken: z.string(), code: z.string().regex(/^\d{6}$/) });
export const CommunityRecoverySchema = z.object({ codes: z.array(z.string()) });
export const CommunityOAuthManageSchema = z.discriminatedUnion('intent', [
    CommunityProofSchema.extend({ provider: CommunityProviderSchema, intent: z.literal('link') }),
    z.object({ provider: CommunityProviderSchema, intent: z.literal('reauthenticate') }),
]);
export const CommunityOAuthCompleteSchema = z.object({ id: z.string(), pollToken: z.string() });
export const CommunityOAuthUnlinkSchema = CommunityProofSchema.extend({ provider: CommunityProviderSchema });

// Account sign-in proves identity; workspace access additionally proves key ownership.
const workspaceKey = z.string().regex(/^[A-Za-z0-9+/]{43}=$/);
const workspaceSignature = z.string().regex(/^[A-Za-z0-9+/]{86}==$/);
const workspaceEnvelope = z.string().min(100).max(512).regex(/^[A-Za-z0-9+/]+={0,2}$/);
export const CommunityWorkspaceOpenSchema = z.object({ recipientKey: workspaceKey });
export const CommunityWorkspaceTicketSchema = z.object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{43}$/), recipientKey: workspaceKey,
    publicKey: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    challenge: z.string().regex(/^[a-zA-Z0-9_-]{43}$/), expiresAt: z.string(),
});
export const CommunityWorkspaceStateSchema = CommunityWorkspaceTicketSchema.extend({ envelope: workspaceEnvelope.nullable() });
export const CommunityWorkspaceProofSchema = z.object({ publicKey: workspaceKey, signature: workspaceSignature });
export const CommunityWorkspaceResultSchema = z.object({ workspaceToken: z.string() });
export const CommunityWorkspaceDeliverySchema = z.object({ envelope: workspaceEnvelope, signature: workspaceSignature });
export const CommunityWorkspaceRequestsSchema = z.object({ requests: z.array(CommunityWorkspaceTicketSchema).max(16) });
export const CommunityWorkspacePairSchema = z.object({ authorization: z.string().max(256), envelope: workspaceEnvelope.optional() });
export const CommunityWorkspacePairResultSchema = z.object({ recipientKey: workspaceKey });
// Account-authenticated, server-encrypted escrow. The seed is returned only
// boxed to this request's ephemeral recipient key; old bindings never reset.
export const CommunityWorkspaceSessionRequestSchema = z.object({ recipientKey: workspaceKey });
export const CommunityWorkspaceSessionSchema = z.discriminatedUnion('status', [
    z.object({ status: z.literal('ready'), identityId: z.string(), publicKey: z.string().regex(/^[a-f0-9]{64}$/),
        envelope: workspaceEnvelope, workspaceToken: z.string() }),
    z.object({ status: z.literal('restore_required'), identityId: z.string(), publicKey: z.string().regex(/^[a-f0-9]{64}$/) }),
]);
export const CommunityWorkspaceEscrowRequestSchema = z.object({ secret: z.string().regex(/^[a-zA-Z0-9_-]{43}$/) });
export const CommunityWorkspaceEscrowResultSchema = z.object({ identityId: z.string(), publicKey: z.string().regex(/^[a-f0-9]{64}$/) });
export function communityWorkspaceDeliveryMessage(ticket: z.infer<typeof CommunityWorkspaceTicketSchema>, envelope: string) {
    return JSON.stringify(["kissopen-workspace-delivery-v1", ticket.id, ticket.recipientKey, ticket.publicKey, ticket.challenge, envelope]);
}
