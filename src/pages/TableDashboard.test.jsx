import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import TableDashboard from "./TableDashboard";
import api from "../utils/api";

// Mock the API module
vi.mock("../utils/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("TableDashboard", () => {
  let mockConfirm;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.confirm - component uses await, so it needs to return a Promise
    mockConfirm = vi.fn(() => Promise.resolve(true));
    Object.defineProperty(window, "confirm", {
      writable: true,
      configurable: true,
      value: mockConfirm,
    });
    // Don't use fake timers - they can cause issues with async operations
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockTables = [
    {
      id: "1",
      number: "1",
      name: "Table 1",
      status: "AVAILABLE",
      capacity: 4,
      isOccupied: false,
      isMerged: false,
    },
    {
      id: "2",
      number: "2",
      name: "Table 2",
      status: "OCCUPIED",
      capacity: 6,
      isOccupied: true,
      isMerged: false,
    },
    {
      id: "3",
      number: "3",
      name: "Table 3",
      status: "RESERVED",
      capacity: 2,
      isOccupied: false,
      isMerged: false,
    },
    {
      id: "4",
      number: "4",
      name: "Table 4",
      status: "CLEANING",
      capacity: 4,
      isOccupied: false,
      isMerged: false,
    },
    {
      id: "5",
      number: "5",
      name: "Table 5",
      status: "AVAILABLE",
      capacity: 8,
      isOccupied: false,
      isMerged: true,
      totalCapacity: 12,
      mergedTables: [{ number: "6" }, { number: "7" }],
    },
  ];

  describe("Loading State", () => {
    it("should display loading spinner initially", async () => {
      api.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<TableDashboard />);

      await waitFor(
        () => {
          const spinner = document.querySelector(".animate-spin");
          expect(spinner).toBeInTheDocument();
        },
        { timeout: 1000 }
      );
    });

    it("should hide loading spinner after data is fetched", async () => {
      api.get.mockResolvedValue({ data: mockTables });

      render(<TableDashboard />);

      await waitFor(
        () => {
          const spinner = document.querySelector(".animate-spin");
          expect(spinner).not.toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe("Data Fetching", () => {
    it("should fetch tables on mount", async () => {
      api.get.mockResolvedValue({ data: mockTables });

      render(<TableDashboard />);

      await waitFor(
        () => {
          expect(api.get).toHaveBeenCalledWith("/tables/dashboard/occupancy");
        },
        { timeout: 3000 }
      );
    });

    it("should handle API errors gracefully", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      api.get.mockRejectedValue(new Error("Network error"));

      render(<TableDashboard />);

      await waitFor(
        () => {
          expect(api.get).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("should handle non-array response data", async () => {
      api.get.mockResolvedValue({ data: null });

      render(<TableDashboard />);

      await waitFor(
        () => {
          expect(screen.getByText("Total Tables")).toBeInTheDocument();
          expect(screen.getByText("0")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe("Statistics Display", () => {
    it("should display correct total tables count", async () => {
      api.get.mockResolvedValue({ data: mockTables });

      render(<TableDashboard />);

      await waitFor(
        () => {
          const totalStat = screen.getByText("Total Tables").closest("div");
          expect(within(totalStat).getByText("5")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it("should display correct available tables count", async () => {
      api.get.mockResolvedValue({ data: mockTables });

      render(<TableDashboard />);

      await waitFor(
        () => {
          const availableStat = screen.getByText("Available").closest("div");
          expect(within(availableStat).getByText("1")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it("should display correct occupied tables count", async () => {
      api.get.mockResolvedValue({ data: mockTables });

      render(<TableDashboard />);

      await waitFor(
        () => {
          const occupiedStat = screen.getByText("Occupied").closest("div");
          expect(within(occupiedStat).getByText("1")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it("should display correct merged tables count", async () => {
      api.get.mockResolvedValue({ data: mockTables });

      render(<TableDashboard />);

      await waitFor(
        () => {
          const mergedStat = screen.getByText("Merged").closest("div");
          expect(within(mergedStat).getByText("1")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe("Table Display", () => {
    it("should render all tables", async () => {
      api.get.mockResolvedValue({ data: mockTables });

      render(<TableDashboard />);

      await waitFor(
        () => {
          expect(screen.getByText("Table 1")).toBeInTheDocument();
          expect(screen.getByText("Table 2")).toBeInTheDocument();
          expect(screen.getByText("Table 3")).toBeInTheDocument();
          expect(screen.getByText("Table 4")).toBeInTheDocument();
          expect(screen.getByText("Table 5")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it("should display table capacity", async () => {
      api.get.mockResolvedValue({ data: mockTables });

      render(<TableDashboard />);

      await waitFor(
        () => {
          expect(screen.getByText(/Capacity: 4 seats/i)).toBeInTheDocument();
          expect(screen.getByText(/Capacity: 6 seats/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it("should display table status", async () => {
      api.get.mockResolvedValue({ data: mockTables });

      render(<TableDashboard />);

      await waitFor(
        () => {
          expect(screen.getByText("AVAILABLE")).toBeInTheDocument();
          expect(screen.getByText("OCCUPIED")).toBeInTheDocument();
          expect(screen.getByText("RESERVED")).toBeInTheDocument();
          expect(screen.getByText("CLEANING")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it("should display merged table information", async () => {
      api.get.mockResolvedValue({ data: mockTables });

      render(<TableDashboard />);

      await waitFor(
        () => {
          expect(
            screen.getByText(/Total \(merged\): 12 seats/i)
          ).toBeInTheDocument();
          expect(screen.getByText(/Merged with: 6, 7/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it("should display waitlist information when present", async () => {
      const tablesWithWaitlist = [
        {
          ...mockTables[0],
          waitlistLength: 3,
        },
      ];
      api.get.mockResolvedValue({ data: tablesWithWaitlist });

      render(<TableDashboard />);

      await waitFor(
        () => {
          expect(screen.getByText(/Waitlist: 3/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it("should display occupied indicator", async () => {
      api.get.mockResolvedValue({ data: mockTables });

      render(<TableDashboard />);

      await waitFor(
        () => {
          expect(screen.getByText(/Currently Occupied/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe("Status Colors", () => {
    it("should apply correct color for AVAILABLE status", async () => {
      api.get.mockResolvedValue({ data: [mockTables[0]] });

      render(<TableDashboard />);

      await waitFor(
        () => {
          const tableCard = screen.getByText("Table 1").closest("div");
          expect(tableCard).toHaveClass("border-l-4");
        },
        { timeout: 3000 }
      );
    });

    it("should handle unknown status gracefully", async () => {
      const unknownTable = [
        {
          id: "99",
          number: "99",
          status: "UNKNOWN_STATUS",
          capacity: 4,
        },
      ];
      api.get.mockResolvedValue({ data: unknownTable });

      render(<TableDashboard />);

      await waitFor(
        () => {
          expect(screen.getByText("UNKNOWN_STATUS")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe("Merge Modal", () => {
    it("should open merge modal when button is clicked", async () => {
      api.get.mockResolvedValue({ data: mockTables });
      const user = userEvent.setup();

      render(<TableDashboard />);

      await waitFor(
        () => {
          expect(screen.getByText("Table 1")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const mergeButton = screen.getByText("Merge Tables");
      await user.click(mergeButton);

      await waitFor(
        () => {
          expect(screen.getByText("Primary Table")).toBeInTheDocument();
          expect(
            screen.getByText("Secondary Tables (select multiple)")
          ).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it("should close merge modal when cancel is clicked", async () => {
      api.get.mockResolvedValue({ data: mockTables });
      const user = userEvent.setup();

      render(<TableDashboard />);

      await waitFor(
        () => {
          expect(screen.getByText("Table 1")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const mergeButton = screen.getByText("Merge Tables");
      await user.click(mergeButton);

      await waitFor(
        () => {
          expect(screen.getByText("Cancel")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const cancelButton = screen.getByText("Cancel");
      await user.click(cancelButton);

      await waitFor(
        () => {
          expect(screen.queryByText("Primary Table")).not.toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it("should show validation alert when merging without selections", async () => {
      api.get.mockResolvedValue({ data: mockTables });
      const user = userEvent.setup();
      global.alert = vi.fn();

      render(<TableDashboard />);

      await waitFor(
        () => {
          expect(screen.getByText("Table 1")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const mergeButton = screen.getByText("Merge Tables");
      await user.click(mergeButton);

      await waitFor(
        () => {
          expect(screen.getByText("Merge")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const mergeSubmitButton = screen.getByText("Merge");
      await user.click(mergeSubmitButton);

      await waitFor(
        () => {
          expect(global.alert).toHaveBeenCalledWith(
            "Please select a primary table and at least one secondary table"
          );
        },
        { timeout: 3000 }
      );
    });
  });

  describe("Unmerge Functionality", () => {
    it("should display unmerge button for merged tables", async () => {
      api.get.mockResolvedValue({ data: mockTables });

      render(<TableDashboard />);

      await waitFor(
        () => {
          expect(screen.getByText("Unmerge")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it("should call unmerge API when unmerge button is clicked", async () => {
      api.get.mockResolvedValue({ data: mockTables });
      api.post.mockResolvedValue({
        data: { message: "Table unmerged successfully" },
      });
      mockConfirm.mockReturnValue(Promise.resolve(true));
      const user = userEvent.setup();

      render(<TableDashboard />);

      await waitFor(
        () => {
          expect(screen.getByText("Unmerge")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const unmergeButtons = screen.getAllByText("Unmerge");
      const unmergeButton = unmergeButtons[0];
      await user.click(unmergeButton);

      await waitFor(
        () => {
          expect(mockConfirm).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      await waitFor(
        () => {
          expect(api.post).toHaveBeenCalled();
        },
        { timeout: 5000 }
      );
    });
  });

  describe("Table Detail Modal", () => {
    it("should open detail modal when table is clicked", async () => {
      api.get.mockResolvedValue({ data: mockTables });
      const user = userEvent.setup();

      render(<TableDashboard />);

      await waitFor(
        () => {
          expect(screen.getByText("Table 1")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Find clickable table card
      const tableText = screen.getByText("Table 1");
      let tableCard = tableText.closest("div");
      while (tableCard && !tableCard.classList.contains("cursor-pointer")) {
        tableCard = tableCard.parentElement;
      }

      if (tableCard) {
        await user.click(tableCard);
      } else {
        await user.click(tableText);
      }

      await waitFor(
        () => {
          expect(screen.getByText("Table 1 Details")).toBeInTheDocument();
          expect(screen.getByText(/Status:/i)).toBeInTheDocument();
          expect(screen.getByText(/Capacity:/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it("should close detail modal when close button is clicked", async () => {
      api.get.mockResolvedValue({ data: mockTables });
      const user = userEvent.setup();

      render(<TableDashboard />);

      await waitFor(
        () => {
          expect(screen.getByText("Table 1")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const tableText = screen.getByText("Table 1");
      let tableCard = tableText.closest("div");
      while (tableCard && !tableCard.classList.contains("cursor-pointer")) {
        tableCard = tableCard.parentElement;
      }

      if (tableCard) {
        await user.click(tableCard);
      }

      await waitFor(
        () => {
          expect(screen.getByText("Close")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const closeButton = screen.getByText("Close");
      await user.click(closeButton);

      await waitFor(
        () => {
          expect(screen.queryByText("Table 1 Details")).not.toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty tables array", async () => {
      api.get.mockResolvedValue({ data: [] });

      render(<TableDashboard />);

      await waitFor(
        () => {
          expect(screen.getByText("Total Tables")).toBeInTheDocument();
          expect(screen.getByText("0")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it("should handle table with missing fields", async () => {
      const incompleteTable = [
        {
          id: "1",
          // Missing number, status, capacity
        },
      ];
      api.get.mockResolvedValue({ data: incompleteTable });

      render(<TableDashboard />);

      await waitFor(
        () => {
          expect(screen.getByText("Table N/A")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe("Accessibility", () => {
    it("should have proper heading structure", async () => {
      api.get.mockResolvedValue({ data: mockTables });

      render(<TableDashboard />);

      await waitFor(
        () => {
          const heading = screen.getByRole("heading", { level: 1 });
          expect(heading).toHaveTextContent("Table Occupancy Dashboard");
        },
        { timeout: 3000 }
      );
    });

    it("should have accessible buttons", async () => {
      api.get.mockResolvedValue({ data: mockTables });

      render(<TableDashboard />);

      await waitFor(
        () => {
          const mergeButton = screen.getByRole("button", {
            name: /merge tables/i,
          });
          expect(mergeButton).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });
});
























