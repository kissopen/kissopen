import { t } from "kissopen-desktop-state";
import type { WelcomeSlide } from "kissopen-desktop-ui";

/** The same welcome deck for the main app and each connection's onboarding. */
export const kissopenAgentWelcomeSlides: readonly WelcomeSlide[] = [
    {
        art: { kind: "logo" },
        copy: "KissOpen integrates models, teams, and compute into one secure, open-source harness—accessible from terminal, desktop, and mobile, deployable anywhere, and adaptable to your team.",
        id: "kissopen",
        title: t("Any team. Any model. One harness."),
    },
    {
        art: { kind: "scene", name: "alien-monster" },
        copy: "Bring your team into one session with every agent. Anyone can share context, steer the conversation, approve decisions, and take over in real time.",
        id: "team",
        title: t("Natively multiplayer"),
    },
    {
        art: { kind: "scene", name: "llama" },
        copy: "Let Claude plan, Codex build, and Grok review—or run them side by side and compare. The context stays together across every handoff.",
        id: "mix",
        title: t("One harness. Every agent."),
    },
    {
        art: { kind: "scene", name: "wand" },
        copy: "KissOpen is open source and built to be changed. Run it on your hardware or in your own cloud—then change KissOpen to fit your team’s needs.",
        id: "open",
        title: t("Yours to run. Yours to change."),
    },
    {
        art: { kind: "scene", name: "closed-lock" },
        copy: "No telemetry. No third-party servers by default. Run KissOpen safely inside corporate networks without leaking data. Every connection between agents, teammates, and mobile clients is end-to-end encrypted.",
        id: "security",
        title: t("Secure and compliant"),
    },
];
