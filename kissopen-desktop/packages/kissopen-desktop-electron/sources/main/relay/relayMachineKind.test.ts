/*
Telling the account's machines apart.

The cloud test is an identity: the business server names the bot, the bot's
session names the machine. The "this computer" test is a match, and the tests
below say exactly how far it reaches — a badge that claims more than it knows
is worse than no badge.
*/
import { describe, it, expect } from "vitest";
import { relayMachineKind } from "./relayMachineKind";
import type { MachineMetadata } from "@kissopen/kissopen-sync/storageTypes";

const local = { host: "mac-studio", homeDir: "/Users/james" };

const metadata = (over: Partial<MachineMetadata> = {}): MachineMetadata =>
    ({
        host: "mac-studio",
        platform: "darwin",
        kissopenCliVersion: "1.0.0",
        kissopenHomeDir: "/Users/james/.kissopen",
        homeDir: "/Users/james",
        ...over,
    }) as MachineMetadata;

describe("which machine is which", () => {
    it("knows this computer by its hostname and home directory", () => {
        expect(relayMachineKind({ machineId: "m1", metadata: metadata(), local })).toBe("this");
    });

    it("does not take another machine for this one", () => {
        expect(
            relayMachineKind({ machineId: "m2", metadata: metadata({ host: "win-box" }), local }),
        ).toBe("other");
        expect(
            relayMachineKind({
                machineId: "m3",
                metadata: metadata({ homeDir: "/Users/someone-else" }),
                local,
            }),
        ).toBe("other");
    });

    /*
     * Windows writes the home directory with backslashes and a drive letter
     * whose case nobody agrees on. Comparing the strings as they arrive would
     * tell this computer apart from itself.
     */
    it("recognises the same path written differently", () => {
        expect(
            relayMachineKind({
                machineId: "m1",
                metadata: metadata({ host: "WIN-BOX", homeDir: "C:\\Users\\James\\" }),
                local: { host: "win-box", homeDir: "C:/Users/james" },
            }),
        ).toBe("this");
    });

    // The cloud workspace is established by identity, so it wins outright.
    it("names the cloud workspace when the account has one", () => {
        expect(
            relayMachineKind({
                machineId: "m-cloud",
                metadata: metadata({ host: "container-7f3a" }),
                cloudMachineId: "m-cloud",
                local,
            }),
        ).toBe("cloud");
    });

    // A machine whose metadata will not open is not this one, and saying
    // "other" is the truthful answer: we do not know what it is.
    it("will not recognise a machine it cannot read", () => {
        expect(relayMachineKind({ machineId: "m4", metadata: null, local })).toBe("other");
    });
});
