import { describe, expect, it } from "vitest";

import {
  canonicalizeMake,
  canonicalizeModel,
  hasUsableMakeModel,
  isJunkMake,
} from "@/lib/makeNormalization";

describe("canonicalizeMake", () => {
  it("merges duplicate spellings of the same brand", () => {
    expect(canonicalizeMake("Bmw")).toBe("BMW");
    expect(canonicalizeMake("BMW")).toBe("BMW");
    expect(canonicalizeMake("Mg")).toBe("MG");
    expect(canonicalizeMake("MG")).toBe("MG");
    expect(canonicalizeMake("Dfsk")).toBe("DFSK");
    expect(canonicalizeMake("TOYOTA")).toBe("Toyota");
    expect(canonicalizeMake("SUZUKI")).toBe("Suzuki");
    expect(canonicalizeMake("KIA")).toBe("Kia");
    expect(canonicalizeMake("Land rover")).toBe("Land Rover");
    expect(canonicalizeMake("proton")).toBe("Proton");
  });

  it("repairs typo spellings seen in live listings", () => {
    expect(canonicalizeMake("Mitshubishi")).toBe("Mitsubishi");
    expect(canonicalizeMake("Sukuzi")).toBe("Suzuki");
    expect(canonicalizeMake("Nisan")).toBe("Nissan");
    expect(canonicalizeMake("Daihatzu")).toBe("Daihatsu");
    expect(canonicalizeMake("Cheery")).toBe("Chery");
  });

  it("keeps genuine multi-word marques", () => {
    expect(canonicalizeMake("Ashok Leyland")).toBe("Ashok Leyland");
    expect(canonicalizeMake("Royal Enfield")).toBe("Royal Enfield");
    expect(canonicalizeMake("John Deere")).toBe("John Deere");
  });

  it("preserves short brand acronyms instead of lowercasing them", () => {
    expect(canonicalizeMake("TVS")).toBe("TVS");
    expect(canonicalizeMake("JAC")).toBe("JAC");
    expect(canonicalizeMake("BYD")).toBe("BYD");
  });

  it("repairs a model that leaked into the make column", () => {
    expect(canonicalizeMake("Honda fit")).toBe("Honda");
    expect(canonicalizeMake("Jeep Wrangler")).toBe("Jeep");
    expect(canonicalizeMake("BAIC Beijing")).toBe("BAIC");
  });

  it("drops junk, test, and year values so they never reach the combobox", () => {
    for (const junk of ["Test", "TestPOS", "testused", "Other brand", "Other Brand", "2018", "2016", ""]) {
      expect(canonicalizeMake(junk)).toBeNull();
      expect(isJunkMake(junk)).toBe(true);
    }
  });
});

describe("canonicalizeModel", () => {
  it("trims and collapses whitespace", () => {
    expect(canonicalizeModel("  Vitz  ")).toBe("Vitz");
  });

  it("drops junk models", () => {
    expect(canonicalizeModel("Test")).toBe("");
    expect(canonicalizeModel("2018")).toBe("");
  });
});

describe("hasUsableMakeModel", () => {
  it("rejects the unnamed listing that was featured as a hero deal", () => {
    expect(hasUsableMakeModel("Other brand", "Other model")).toBe(false);
    expect(hasUsableMakeModel("Test", "TestPOS")).toBe(false);
  });

  it("accepts a real car", () => {
    expect(hasUsableMakeModel("Toyota", "Vitz")).toBe(true);
  });
});
