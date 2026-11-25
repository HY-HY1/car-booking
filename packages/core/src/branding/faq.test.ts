import { describe, expect, it } from "vitest";
import { MAX_FAQS, answerParagraphs, faqsSchema, parseFaqForm } from "./faq";

describe("questions and answers", () => {
  it("drops broken entries rather than the whole list", () => {
    expect(faqsSchema.parse([{ question: "Do you need water?", answer: "Yes, an outside tap." }, { question: "", answer: "x" }, "junk"])).toEqual([
      { question: "Do you need water?", answer: "Yes, an outside tap." },
    ]);
    expect(faqsSchema.parse(undefined)).toEqual([]);
  });

  it("keeps the form's order, skipping blank rows and tidying the text", () => {
    const parsed = parseFaqForm(["  How long   does it take? ", "", "Do you need power?"], ["About two hours.\r\n\r\n\r\nLonger for vans.", "  ", "No."]);
    expect(parsed).toEqual({
      faqs: [
        { question: "How long does it take?", answer: "About two hours.\n\nLonger for vans." },
        { question: "Do you need power?", answer: "No." },
      ],
    });
  });

  it("flags half-filled rows beside the right box", () => {
    expect(parseFaqForm(["Question only", ""], ["", "Answer only"]).errors).toEqual({
      answer_0: "Add an answer, or clear the question to remove it.",
      question_1: "Add the question, or clear the answer to remove it.",
    });
  });

  it("refuses too many or too long", () => {
    const many = Array.from({ length: MAX_FAQS + 1 }, (_, i) => `Q${i}`);
    expect(parseFaqForm(many, many).errors?.faqs).toBeDefined();
    expect(parseFaqForm(["x".repeat(151)], ["ok"]).errors?.question_0).toBeDefined();
  });

  it("splits an answer into paragraphs", () => {
    expect(answerParagraphs("One.\nStill one.\n\nTwo.")).toEqual(["One.\nStill one.", "Two."]);
  });
});
