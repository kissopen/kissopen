import { t, type KissopenInvite } from "kissopen-desktop-state";

/** What a person copies to invite someone: a line about the product and the link. */
export function kissopenInviteMessage(invite: KissopenInvite): string {
    return invite.invitee_points > 0
        ? t("我在用KissOpen，一起把事情做好。用我的邀请链接注册送 {points} 点：{link}", {
              points: invite.invitee_points,
              link: invite.link,
          })
        : t("我在用KissOpen，一起把事情做好。来试试：{link}", { link: invite.link });
}
