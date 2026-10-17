import { describe, expect, it } from "vitest";
import {
  CIPHER_PREFIX,
  childRoomId,
  decryptBody,
  deriveRoomKey,
  encryptBody,
  parseInvite,
  parseRoomId,
  roomBusName,
  roomChannel,
  roomInvite,
  spatialHeaderHex,
} from "./rooms";
import { isPttKey } from "./ptt-key";

describe("room ids", () => {
  it("parses a plain channel", () => {
    expect(parseRoomId("19")).toEqual({ channel: 19, branches: [] });
  });

  it("parses nested rooms", () => {
    expect(parseRoomId("19.1.2")).toEqual({ channel: 19, branches: [1, 2] });
  });

  it("rejects out-of-plan channels and bad branches", () => {
    expect(parseRoomId("41")).toBeNull();
    expect(parseRoomId("0.1")).toBeNull();
    expect(parseRoomId("19.0")).toBeNull();
    expect(parseRoomId("nineteen")).toBeNull();
  });

  it("maps to a stable bus name", () => {
    expect(roomBusName("19")).toBe("ptt-19");
    expect(roomBusName("9.1")).toBe("ptt-09.1");
    expect(roomBusName("bogus")).toBe("ptt-19");
  });

  it("finds the next free branch", () => {
    expect(childRoomId("19", ["19.1", "19.2"])).toBe("19.3");
    expect(childRoomId("19.1", [])).toBe("19.1.1");
  });

  it("reads the channel back", () => {
    expect(roomChannel("9.1.1")).toBe(9);
  });
});

describe("invites", () => {
  it("round-trips a locked room", () => {
    const r = { id: "19.1", channel: 19, label: "ROOM 19.1", code: "ABCDEFGH12345678" };
    expect(parseInvite(roomInvite(r))).toEqual(r);
  });

  it("round-trips an open room", () => {
    const parsed = parseInvite("APEXCB:19.2:");
    expect(parsed?.id).toBe("19.2");
    expect(parsed?.code).toBeUndefined();
  });

  it("rejects junk", () => {
    expect(parseInvite("hello")).toBeNull();
    expect(parseInvite("APEXCB:99:AAA")).toBeNull();
  });
});

describe("room encryption", () => {
  it("round-trips a payload", async () => {
    const key = await deriveRoomKey("TESTCODE12345678");
    const sealed = await encryptBody(key, "meet at the ridge");
    expect(sealed.startsWith(CIPHER_PREFIX)).toBe(true);
    expect(sealed).not.toContain("ridge");
    expect(await decryptBody(key, sealed)).toBe("meet at the ridge");
  });

  it("refuses a wrong key", async () => {
    const a = await deriveRoomKey("AAAAAAAAAAAAAAAA");
    const b = await deriveRoomKey("BBBBBBBBBBBBBBBB");
    expect(await decryptBody(b, await encryptBody(a, "secret"))).toBeNull();
  });

  it("passes plaintext straight through", async () => {
    const key = await deriveRoomKey("AAAAAAAAAAAAAAAA");
    expect(await decryptBody(key, "plain")).toBe("plain");
  });
});

describe("spatial header", () => {
  it("emits a 4-byte field behind the depth flag", () => {
    expect(spatialHeaderHex(1n)).toBe("0000000001");
    expect(spatialHeaderHex(0n).length).toBe(10);
  });
});

describe("hardware ptt key", () => {
  it("matches the common rugged-handset codes", () => {
    expect(isPttKey({ code: "F24", keyCode: 0 }, null)).toBe(true);
    expect(isPttKey({ code: "Unidentified", keyCode: 79 }, null)).toBe(true);
    expect(isPttKey({ code: "KeyA", keyCode: 65 }, null)).toBe(false);
  });

  it("prefers a learned key once set", () => {
    const learned = { code: "F13", keyCode: 124 };
    expect(isPttKey({ code: "F13", keyCode: 0 }, learned)).toBe(true);
    expect(isPttKey({ code: "F24", keyCode: 0 }, learned)).toBe(false);
  });
});
