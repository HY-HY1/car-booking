import { describe, expect, it } from "vitest";
import { MAX_VIDEOS, embedUrl, parseVideoIntro, parseVideoLink, parseVideosForm, socialButtonLabel, uploadedPaths, videosSchema } from "./videos";

const T = "11111111-2222-4333-8444-555555555555";
const P = `${T}/videos/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.mp4`;

describe("video links", () => {
  it("recognises YouTube, Shorts, Vimeo, TikTok and Instagram", () => {
    expect(parseVideoLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toEqual({ provider: "youtube", id: "dQw4w9WgXcQ", vertical: false });
    expect(parseVideoLink("youtu.be/dQw4w9WgXcQ")).toEqual({ provider: "youtube", id: "dQw4w9WgXcQ", vertical: false });
    expect(parseVideoLink("https://youtube.com/shorts/abcDEF12345")).toEqual({ provider: "youtube", id: "abcDEF12345", vertical: true });
    expect(parseVideoLink("https://vimeo.com/123456789")).toEqual({ provider: "vimeo", id: "123456789", vertical: false });
    expect(parseVideoLink("https://www.tiktok.com/@shine/video/7301234567890123456")).toEqual({ provider: "tiktok", id: "7301234567890123456", vertical: true });
    expect(parseVideoLink("https://www.instagram.com/reel/C1a2B3c4D5e/")).toEqual({ provider: "instagram", id: "C1a2B3c4D5e", vertical: true });
  });

  it("refuses anything else, or an id that could break out of the player address", () => {
    expect(parseVideoLink("https://example.com/video.mp4")).toBeNull();
    expect(parseVideoLink("https://www.youtube.com/watch?v=abc\"><script>")).toBeNull();
    expect(parseVideoLink("not a link at all")).toBeNull();
  });

  it("plays YouTube without cookies and Vimeo without tracking", () => {
    expect(embedUrl({ kind: "link", provider: "youtube", id: "dQw4w9WgXcQ", vertical: false })).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(embedUrl({ kind: "link", provider: "vimeo", id: "123456789", vertical: false })).toContain("dnt=1");
  });
});

describe("videos setting", () => {
  it("drops a broken video rather than all of them", () => {
    expect(
      videosSchema.parse([
        { kind: "upload", path: P, caption: " Snow foam " },
        { kind: "upload", path: "../../etc/passwd" },
        { kind: "link", provider: "youtube", id: "dQw4w9WgXcQ", vertical: false },
      ]),
    ).toEqual([
      { kind: "upload", path: P, vertical: true, caption: "Snow foam" },
      { kind: "link", provider: "youtube", id: "dQw4w9WgXcQ", vertical: false },
    ]);
  });

  it("keeps the form's videos in order: uploads only from this business's folder", () => {
    const parsed = parseVideosForm([`upload:h:${P}`, "link:https://youtu.be/dQw4w9WgXcQ", `upload:v:${P}`], ["", " Full valet "], T);
    expect(parsed).toEqual({
      videos: [
        { kind: "upload", path: P, vertical: false },
        { kind: "link", provider: "youtube", id: "dQw4w9WgXcQ", vertical: false, caption: "Full valet" },
        { kind: "upload", path: P, vertical: true },
      ],
    });
    const other = parseVideosForm([`upload:${P.replace(T, "99999999-2222-4333-8444-555555555555")}`], [], T);
    expect(other.errors?.video_0).toBeDefined();
    expect(parseVideosForm(["link:https://example.com/x"], [], T).errors?.video_0).toBeDefined();
  });

  it("refuses more than the limit, and lists the uploads used", () => {
    expect(parseVideosForm(Array(MAX_VIDEOS + 1).fill("link:https://youtu.be/dQw4w9WgXcQ"), [], T).errors?.videos).toBeDefined();
    expect(uploadedPaths([{ kind: "upload", path: P, vertical: true }, { kind: "link", provider: "vimeo", id: "123456789", vertical: false }])).toEqual([P]);
  });
});

describe("the video section's words and link", () => {
  it("names the social site on the button", () => {
    expect(socialButtonLabel("https://www.instagram.com/ascnd")).toBe("See more on Instagram");
    expect(socialButtonLabel("https://tiktok.com/@ascnd")).toBe("See more on TikTok");
    expect(socialButtonLabel("https://ascnd.co.uk/gallery")).toBe("See more of our work");
  });

  it("tidies what was typed: the link made https, blanks left out", () => {
    expect(parseVideoIntro({ heading: "  ", text: " Watch   us work ", social: "instagram.com/ascnd" })).toEqual({
      intro: { text: "Watch us work", social_url: "https://instagram.com/ascnd" },
    });
    expect(parseVideoIntro({ heading: "", text: "", social: "not a link" }).errors?.social_url).toBeDefined();
  });
});
