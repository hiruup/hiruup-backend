import { describe, test, expect } from "bun:test";
import {
  calculatePm25Aqi,
  getAqiCategory,
  getAdvice,
  validateAqi,
  isDataStale,
} from "../../src/core/aqi/calculator";

describe("AQI Calculator & Advice Rules", () => {
  describe("getAqiCategory", () => {
    test("maps AQI ranges correctly", () => {
      expect(getAqiCategory(0)).toBe("good");
      expect(getAqiCategory(50)).toBe("good");
      expect(getAqiCategory(51)).toBe("moderate");
      expect(getAqiCategory(100)).toBe("moderate");
      expect(getAqiCategory(101)).toBe("unhealthy for sensitive groups");
      expect(getAqiCategory(150)).toBe("unhealthy for sensitive groups");
      expect(getAqiCategory(151)).toBe("unhealthy");
      expect(getAqiCategory(200)).toBe("unhealthy");
      expect(getAqiCategory(201)).toBe("very unhealthy");
      expect(getAqiCategory(300)).toBe("very unhealthy");
      expect(getAqiCategory(301)).toBe("hazardous");
      expect(getAqiCategory(500)).toBe("hazardous");
    });
  });

  describe("getAdvice", () => {
    test("mask_recommended is true only when AQI > 150", () => {
      expect(getAdvice(150).mask_recommended).toBe(false);
      expect(getAdvice(151).mask_recommended).toBe(true);
      expect(getAdvice(200).mask_recommended).toBe(true);
    });

    test("sensitive_groups_warning is true only when AQI > 100", () => {
      expect(getAdvice(100).sensitive_groups_warning).toBe(false);
      expect(getAdvice(101).sensitive_groups_warning).toBe(true);
      expect(getAdvice(150).sensitive_groups_warning).toBe(true);
    });
  });

  describe("calculatePm25Aqi", () => {
    test("calculates correct AQI for known PM2.5 concentrations", () => {
      // 0 concentration -> 0 AQI
      expect(calculatePm25Aqi(0)).toBe(0);
      // 9.0 concentration (2024 EPA boundary) -> 50 AQI
      expect(calculatePm25Aqi(9.0)).toBe(50);
      // 35.4 concentration -> 100 AQI
      expect(calculatePm25Aqi(35.4)).toBe(100);
      // 55.4 concentration -> 150 AQI
      expect(calculatePm25Aqi(55.4)).toBe(150);
      // 125.4 concentration -> 200 AQI
      expect(calculatePm25Aqi(125.4)).toBe(200);
    });
  });

  describe("validateAqi", () => {
    test("returns 'ok' when headline AQI matches calculated PM2.5 within threshold", () => {
      // 35.4 ug/m3 yields ~100 AQI, headline 105 is within delta 15
      expect(validateAqi(105, "pm25", { pm25: 35.4 })).toBe("ok");
    });

    test("returns 'uncertain' when difference exceeds threshold", () => {
      // 10 ug/m3 yields ~53 AQI, but headline is reported as 180
      expect(validateAqi(180, "pm25", { pm25: 10.0 }, { threshold: 15 })).toBe("uncertain");
    });

    test("returns 'ok' when dominant pollutant is not pm25", () => {
      expect(validateAqi(120, "o3", { o3: 40 })).toBe("ok");
    });
  });

  describe("isDataStale", () => {
    test("returns false for recent data", () => {
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
      expect(isDataStale(oneHourAgo)).toBe(false);
    });

    test("returns true for data older than 3 hours", () => {
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      expect(isDataStale(fourHoursAgo)).toBe(true);
    });
  });
});
