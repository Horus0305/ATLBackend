import express from "express";
import { MaterialTest } from "../models/MaterialTest.js";
import { sendReportEmail } from "../utils/emailService.js";
import puppeteer from "puppeteer";
import puppeteerCore from "puppeteer-core";
import chromium from "@sparticuz/chromium-min";

const router = express.Router();

// Helper function to initialize puppeteer browser based on environment
async function initializeBrowser() {
  if (process.env.VERCEL_ENV === 'production') {
    const executablePath = await chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar');
    return puppeteerCore.launch({
      executablePath,
      args: chromium.args,
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport
    });
  } else {
    return puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
}

router.post("/create", async (req, res) => {
  try {
    const materialTest = new MaterialTest({
      ...req.body,
      jobCards: {}, // Initialize with empty job cards
      status: "Test Data Entered", // Initial status
      materialAtlIds: req.body.materialAtlIds, // Add this line
    });
    await materialTest.save();
    res
      .status(201)
      .json({ ok: true, message: "Material test created successfully" });
  } catch (error) {
    console.error("Error creating material test:", error);
    res.status(500).json({
      ok: false,
      error: error.message || "Failed to create material test",
    });
  }
});

router.get("/all", async (req, res) => {
  try {
    const tests = await MaterialTest.find().sort({ createdAt: -1 });
    res.json({ ok: true, tests });
  } catch (error) {
    console.error("Error fetching material tests:", error);
    res.status(500).json({
      ok: false,
      error: error.message || "Failed to fetch material tests",
    });
  }
});

// Generate job card
router.post("/:id/jobcard", async (req, res) => {
  try {
    const test = await MaterialTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    // Get unique departments from test types
    const departments = new Set();
    test.tests.forEach(t => {
      const department = t.testType.split("-")[0]?.trim().toUpperCase();
      if (department === "MECHANICAL" || department === "MECHANICAL-NDT") {
        departments.add("mechanical");
      } else if (department === "CHEMICAL") {
        departments.add("chemical");
      }
    });

    // Initialize job cards for each department
    test.jobCards = Array.from(departments).reduce((acc, dept) => {
      acc[dept] = { status: 0, remark: "" }; // 0 for pending
      return acc;
    }, {});

    // Store the required departments in the test document
    test.requiredDepartments = Array.from(departments);

    test.status = "Job Card Created";
    test.markModified("jobCards");
    test.markModified("requiredDepartments");
    await test.save();

    res.json({ ok: true, test: test });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send job card for approval
router.post("/:id/jobcard/send", async (req, res) => {
  try {
    const test = await MaterialTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    // Update status for sending to approval
    test.status = "Job Card Sent for Approval";

    // Get unique departments from test types
    const departments = new Set();
    test.tests.forEach(t => {
      const department = t.testType.split("-")[0]?.trim().toUpperCase();
      if (department === "MECHANICAL" || department === "MECHANICAL-NDT") {
        departments.add("mechanical");
      } else if (department === "CHEMICAL") {
        departments.add("chemical");
      }
    });

    // Ensure job cards exist for each department
    if (!test.jobCards) {
      test.jobCards = {};
    }

    Array.from(departments).forEach(dept => {
      if (!test.jobCards[dept]) {
        test.jobCards[dept] = { status: 0, remark: "" }; // 0 for pending
      }
    });

    test.markModified("jobCards");
    await test.save();

    res.json({ ok: true, test });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject job card
router.post("/:id/jobcard/reject", async (req, res) => {
  try {
    const test = await MaterialTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const { department } = req.body;
    const departmentKey = department.toLowerCase();

    // Update the specific department's job card status
    if (test.jobCards && test.jobCards[departmentKey]) {
      test.jobCards[departmentKey].status = 2; // 2 for rejected
      test.markModified("jobCards");
    }

    test.status = "Job Card Rejected";
    await test.save();
    res.json({ ok: true, test });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve job card
router.post("/:id/jobcard/approve", async (req, res) => {
  try {
    const test = await MaterialTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const { department, assignedTo } = req.body;
    const departmentKey = department.toLowerCase();

    // Initialize jobCards if it doesn't exist
    if (!test.jobCards) {
      test.jobCards = {};
    }

    // Update the specific department's job card status
    if (!test.jobCards[departmentKey]) {
      test.jobCards[departmentKey] = {};
    }
    test.jobCards[departmentKey].status = 1; // 1 for approved
    test.jobCards[departmentKey].assignedTo = assignedTo; // Add the assignedTo field
    test.markModified("jobCards");

    // Check if all REQUIRED job cards are approved
    const requiredDepartments =
      test.requiredDepartments || Object.keys(test.jobCards);
    const allRequiredApproved = requiredDepartments.every(
      (dept) => test.jobCards[dept] && test.jobCards[dept].status === 1
    );

    if (allRequiredApproved) {
      test.status = "Job Assigned to Testers";
    }

    await test.save();
    res.json({ ok: true, test });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add this new route
router.post("/lastAtlId", async (req, res) => {
  try {
    const { year, month } = req.body;

    if (!year || !month) {
      return res.status(400).json({
        ok: false,
        error: "Year and month are required",
      });
    }

    const lastNumber = await MaterialTest.getLastAtlIdNumber(year, month);

    res.json({
      ok: true,
      lastNumber,
    });
  } catch (error) {
    console.error("Error getting last ATL ID:", error);
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// Upload test report
router.post("/:id/report", async (req, res) => {
  try {
    const test = await MaterialTest.findById(req.params.id);
    if (!test) {
      console.log("Test not found with ID:", req.params.id);
      return res.status(404).json({ error: "Test not found" });
    }

    const {
      atlId,
      testType,
      material,
      equipmenttable,
      resulttable,
      reportHtml,
      fromDate,
      toDate
    } = req.body;

    if (!atlId || !testType || !material) {
      console.log("Missing required fields:", {
        atlId: !!atlId,
        testType: !!testType,
        material: !!material,
      });
      return res.status(400).json({
        error: "Missing required fields: atlId, testType, and material",
      });
    }

    // Find the test with matching atlId, testType, AND material
    const testIndex = test.tests.findIndex(
      (t) =>
        t.atlId === atlId && t.testType === testType && t.material === material
    );
    console.log("Found test at index:", testIndex);

    if (testIndex === -1) {
      console.log("Test with ATL ID, test type, and material not found:", {
        atlId,
        testType,
        material,
      });
      return res.status(404).json({
        error: `Test with ATL ID ${atlId}, type ${testType}, and material ${material} not found`,
      });
    }

    // Store the equipment and result tables HTML
    if (equipmenttable) {
      test.tests[testIndex].equipmenttable = equipmenttable;
      console.log("Equipment table HTML saved to test at index:", testIndex);
    }

    if (resulttable) {
      test.tests[testIndex].resulttable = resulttable;
      console.log("Result table HTML saved to test at index:", testIndex);
    }

    // Store the full report HTML
    if (reportHtml) {
      test.tests[testIndex].reporturl = reportHtml;
      console.log("Report HTML saved to test at index:", testIndex);
    }

    // Store test period dates if provided
    if (fromDate) {
      test.tests[testIndex].fromDate = new Date(fromDate);
      console.log("From date saved:", fromDate);
    }
    
    if (toDate) {
      test.tests[testIndex].toDate = new Date(toDate);
      console.log("To date saved:", toDate);
    }

    // Mark the tests array as modified to ensure MongoDB saves the changes
    test.markModified("tests");

    // Save the document
    await test.save();
    console.log("Test document saved successfully");

    // Verify the tables were saved
    const verifyTest = await MaterialTest.findById(req.params.id);
    if (verifyTest) {
      const verifyTestIndex = verifyTest.tests.findIndex(
        (t) =>
          t.atlId === atlId && t.testType === testType && t.material === material
      );
      if (verifyTestIndex !== -1) {
        const savedTest = verifyTest.tests[verifyTestIndex];
        console.log("Verification: Equipment table saved:", !!savedTest.equipmenttable);
        console.log("Verification: Result table saved:", !!savedTest.resulttable);
        console.log("Verification: Report HTML saved:", !!savedTest.reporturl);
        console.log("Verification: From date saved:", savedTest.fromDate);
        console.log("Verification: To date saved:", savedTest.toDate);
      }
    }

    res.json({ ok: true, test });
  } catch (error) {
    console.error("Error uploading test report:", error);
    res.status(500).json({ error: error.message });
  }
});

// Add this new route to get test standards
router.get("/standards", async (req, res) => {
  try {
    // Get all unique tests with their standards from the MaterialTest collection
    const tests = await MaterialTest.aggregate([
      // Unwind the tests array to get individual test documents
      { $unwind: "$tests" },
      // Unwind the nested tests array to get individual test standards
      { $unwind: "$tests.tests" },
      // Group by material, testType, and standard to get unique combinations
      {
        $group: {
          _id: {
            material: "$tests.material",
            testType: "$tests.testType",
            standard: "$tests.tests.standard",
          },
        },
      },
      // Project the fields in the desired format
      {
        $project: {
          _id: 0,
          material: "$_id.material",
          testType: "$_id.testType",
          standard: "$_id.standard",
        },
      },
    ]);

    res.json({
      ok: true,
      standards: tests,
    });
  } catch (error) {
    console.error("Error fetching test standards:", error);
    res.status(500).json({
      ok: false,
      error: error.message || "Failed to fetch test standards",
    });
  }
});

// Add this route to get a single test by ID
router.get("/:id", async (req, res) => {
  try {
    console.log("Fetching test details for ID:", req.params.id);

    const test = await MaterialTest.findById(req.params.id);

    if (!test) {
      return res.status(404).json({
        error: "Test not found",
        ok: false,
      });
    }

    // Log the exact response being sent
    const response = {
      test,
      ok: true,
    };
    // console.log("\nResponse being sent:", JSON.stringify(response, null, 2));

    res.json(response);
  } catch (error) {
    console.error("Error fetching test details:", error);
    res.status(500).json({
      error: "Failed to fetch test details",
      ok: false,
    });
  }
});

// Add this route to update a table (equipment or result)
router.post("/:id/update-table", async (req, res) => {
  try {
    console.log("Table update request received for test ID:", req.params.id);

    const test = await MaterialTest.findById(req.params.id);
    if (!test) {
      console.log("Test not found with ID:", req.params.id);
      return res.status(404).json({ error: "Test not found", ok: false });
    }

    const {
      atlId,
      testType,
      material,
      equipmenttable,
      resulttable
    } = req.body;

    if (!atlId || !testType || !material) {
      console.log("Missing required fields:", {
        atlId: !!atlId,
        testType: !!testType,
        material: !!material,
      });
      return res.status(400).json({
        error: "Missing required fields: atlId, testType, and material",
        ok: false,
      });
    }

    // Find the test with matching atlId, testType, AND material
    const testIndex = test.tests.findIndex(
      (t) =>
        t.atlId === atlId && t.testType === testType && t.material === material
    );

    if (testIndex === -1) {
      console.log("Test with ATL ID, test type, and material not found:", {
        atlId,
        testType,
        material,
      });
      return res.status(404).json({
        error: `Test with ATL ID ${atlId}, type ${testType}, and material ${material} not found`,
        ok: false,
      });
    }

    // Update the appropriate fields
    let updated = false;

    if (equipmenttable) {
      // Store only the table content
      test.tests[testIndex].equipmenttable = equipmenttable;
      console.log("Equipment table updated for test at index:", testIndex);
      updated = true;
    }

    if (resulttable) {
      // Store only the table content
      test.tests[testIndex].resulttable = resulttable;
      console.log("Result table updated for test at index:", testIndex);
      updated = true;
    }

    if (!updated) {
      return res.status(400).json({
        error: "No table data provided to update",
        ok: false,
      });
    }

    // Save the updated test document
    await test.save();

    return res.json({
      message: "Tables updated successfully",
      ok: true,
    });
  } catch (error) {
    console.error("Error updating tables:", error);
    return res.status(500).json({
      error: "Internal server error while updating tables",
      ok: false,
    });
  }
});

// Add this route to send a test for approval
router.post("/:id/send-for-approval", async (req, res) => {
  try {
    console.log(
      "Send for approval request received for test ID:",
      req.params.id
    );

    const test = await MaterialTest.findById(req.params.id);
    if (!test) {
      console.log("Test not found with ID:", req.params.id);
      return res.status(404).json({ error: "Test not found", ok: false });
    }

    const { atlId, testType, material } = req.body;

    if (!atlId || !testType || !material) {
      console.log("Missing required fields:", {
        atlId: !!atlId,
        testType: !!testType,
        material: !!material,
      });
      return res.status(400).json({
        error: "Missing required fields: atlId, testType, and material",
        ok: false,
      });
    }

    // Find the test with matching atlId, testType, AND material
    const testIndex = test.tests.findIndex(
      (t) =>
        t.atlId === atlId && t.testType === testType && t.material === material
    );

    if (testIndex === -1) {
      console.log("Test with ATL ID, test type, and material not found:", {
        atlId,
        testType,
        material,
      });
      return res.status(404).json({
        error: `Test with ATL ID ${atlId}, type ${testType}, and material ${material} not found`,
        ok: false,
      });
    }

    // Verify that equipment and result tables exist
    if (
      !test.tests[testIndex].equipmenttable ||
      !test.tests[testIndex].resulttable
    ) {
      return res.status(400).json({
        error:
          "Both equipment and result tables must be completed before sending for approval",
        ok: false,
      });
    }

    // Update the test status to "Test Values Added" or appropriate status
    test.status = "Test Values Added";

    // Mark the tests array as modified to ensure MongoDB saves the changes
    test.markModified("tests");

    // Save the document
    await test.save();
    console.log('Test status updated to "Test Values Added"');

    res.json({
      ok: true,
      message: "Test sent for approval successfully",
    });
  } catch (error) {
    console.error("Error sending test for approval:", error);
    res.status(500).json({
      error: error.message || "Failed to send test for approval",
      ok: false,
    });
  }
});

// Send test results for approval
router.post("/:id/send-for-approval", async (req, res) => {
  try {
    const test = await MaterialTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const { atlId, testType, material } = req.body;

    // Find the specific test
    const testIndex = test.tests.findIndex(
      (t) =>
        t.atlId === atlId && t.testType === testType && t.material === material
    );

    if (testIndex === -1) {
      return res.status(404).json({ error: "Specific test not found" });
    }

    // Check if both tables exist
    if (
      !test.tests[testIndex].equipmenttable ||
      !test.tests[testIndex].resulttable
    ) {
      return res.status(400).json({
        error:
          "Both equipment and result tables must be completed before sending for approval",
      });
    }

    // Update the test result status
    test.tests[testIndex].testResultStatus = "Sent for Approval";
    test.markModified("tests");
    await test.save();

    res.json({ ok: true, test });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve test results
router.post("/:id/approve-results", async (req, res) => {
  try {
    const test = await MaterialTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const { atlId, testType, material } = req.body;

    // Find the specific test
    const testIndex = test.tests.findIndex(
      (t) =>
        t.atlId === atlId && t.testType === testType && t.material === material
    );

    if (testIndex === -1) {
      return res.status(404).json({ error: "Specific test not found" });
    }

    // Update the test result status
    test.tests[testIndex].testResultStatus = "Results Approved";

    // Check if all tests have Results Approved status
    const allTestsApproved = test.tests.every(
      (t) => t.testResultStatus === "Results Approved"
    );
    console.log("All tests approved:", allTestsApproved);

    if (allTestsApproved) {
      test.status = "Report Generated";
    }

    test.markModified("tests");
    await test.save();

    res.json({ ok: true, test });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject test results
router.post("/:id/reject-results", async (req, res) => {
  try {
    const test = await MaterialTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const { atlId, testType, material, remark } = req.body;

    if (!remark) {
      return res
        .status(400)
        .json({ error: "Remark is required for rejection" });
    }

    // Find the specific test
    const testIndex = test.tests.findIndex(
      (t) =>
        t.atlId === atlId && t.testType === testType && t.material === material
    );

    if (testIndex === -1) {
      return res.status(404).json({ error: "Specific test not found" });
    }

    // Update the test result status and remark
    test.tests[testIndex].testResultStatus = "Results Rejected";
    test.tests[testIndex].testResultRemark = remark;
    test.markModified("tests");
    await test.save();

    res.json({ ok: true, test });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send report for approval
router.post("/:id/report/send-for-approval", async (req, res) => {
  try {
    const test = await MaterialTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const { atlId, testType, material } = req.body;

    // Find the specific test
    const testIndex = test.tests.findIndex(
      (t) =>
        t.atlId === atlId && t.testType === testType && t.material === material
    );

    if (testIndex === -1) {
      return res.status(404).json({ error: "Specific test not found" });
    }

    // Check if report exists
    if (!test.tests[testIndex].reporturl) {
      return res.status(400).json({
        error: "Report must be generated before sending for approval",
      });
    }

    // Update the test status
    test.status = "Report Sent for Approval";
    test.reportStatus = 1; // 1 for pending approval
    test.markModified("tests");
    await test.save();

    res.json({ ok: true, test });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve report
router.post("/:id/report/approve", async (req, res) => {
  try {
    const test = await MaterialTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const { atlId, testType, material } = req.body;

    // Find the specific test
    const testIndex = test.tests.findIndex(
      (t) =>
        t.atlId === atlId && t.testType === testType && t.material === material
    );

    if (testIndex === -1) {
      return res.status(404).json({ error: "Specific test not found" });
    }

    // Update the test status
    test.status = "Report Approved";
    test.reportStatus = 2; // 2 for approved
    test.markModified("tests");
    await test.save();

    res.json({ ok: true, test });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject report
router.post("/:id/report/reject", async (req, res) => {
  try {
    const test = await MaterialTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const { atlId, testType, material, remark } = req.body;

    if (!remark?.trim()) {
      return res.status(400).json({ error: "Rejection remark is required" });
    }

    // Find the specific test
    const testIndex = test.tests.findIndex(
      (t) =>
        t.atlId === atlId && t.testType === testType && t.material === material
    );

    if (testIndex === -1) {
      return res.status(404).json({ error: "Specific test not found" });
    }

    // Update the test status
    test.status = "Report Rejected";
    test.reportStatus = 3; // 3 for rejected
    test.tests[testIndex].reportRemark = remark.trim();
    test.markModified("tests");
    await test.save();

    res.json({ ok: true, test });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send report as email to client (section head action)
router.post("/:id/send-report-mail", async (req, res) => {
  try {
    const test = await MaterialTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ ok: false, error: "Test not found" });
    }

    const { ccEmails = [], atlId, testType, material } = req.body;

    // Find the specific test
    const testDetail = test.tests.find(
      (t) =>
        t.atlId === atlId && t.testType === testType && t.material === material
    );

    if (!testDetail || !testDetail.reporturl) {
      return res
        .status(400)
        .json({ ok: false, error: "Report not found for this test" });
    }

    // Check if this specific report is approved
    if (testDetail.testReportApproval !== 2) {
      return res.status(400).json({
        ok: false,
        error: "This specific report must be approved before sending as email",
      });
    }

    // Generate PDF from HTML using puppeteer with simplified settings
    const browser = await initializeBrowser();
    
    const page = await browser.newPage();
    
    // Set viewport for better rendering
    await page.setViewport({
      width: 1024,
      height: 1440,
      deviceScaleFactor: 2
    });

    // Set content with minimal waiting since it's static HTML
    await page.setContent(testDetail.reporturl, {
      waitUntil: ["networkidle0", "domcontentloaded"],
    });
    // console.log(testDetail.reporturl);

    // Generate PDF with proper settings for full-page and multi-page support
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0px",
        right: "0px",
        bottom: "0px",
        left: "0px"
      },
      preferCSSPageSize: true
    });

    await browser.close();

    // Send the report as a PDF attachment
    await sendReportEmail({
      to: test.emailId,
      cc: ccEmails,
      clientName: test.clientName,
      testId: test.testId,
      pdfBuffer,
    });

    // Update individual report status
    testDetail.reportMailStatus = true;

    // Check if all approved reports have been mailed
    const allApprovedReportsMailed = test.tests.every((t) => {
      // If report is approved, it should be mailed
      return t.testReportApproval !== 2 || t.reportMailStatus === true;
    });

    // Only update overall status if all approved reports have been mailed
    if (allApprovedReportsMailed) {
      test.status = "Report Mailed to Client";
    }

    await test.save();

    res.json({ ok: true, message: "Report sent successfully" });
  } catch (error) {
    console.error("Error sending report email:", error);
    res.status(500).json({
      ok: false,
      error: error.message || "Failed to send report email",
    });
  }
});

// Mark test as completed (receptionist action)
router.post("/:id/mark-complete", async (req, res) => {
  try {
    const test = await MaterialTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ ok: false, error: "Test not found" });
    }
    if (test.status !== "Report Mailed to Client") {
      return res.status(400).json({
        ok: false,
        error: "Test can only be completed after report is mailed to client",
      });
    }
    test.status = "Completed";
    await test.save();
    res.json({ ok: true, message: "Test marked as completed." });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message || "Failed to mark as complete",
    });
  }
});

// Edit report without changing status
router.post("/:id/report/edit", async (req, res) => {
  try {
    const test = await MaterialTest.findById(req.params.id);
    if (!test) {
      console.log("Test not found with ID:", req.params.id);
      return res.status(404).json({ error: "Test not found" });
    }

    const { atlId, testType, material, reportHtml } = req.body;

    if (!atlId || !testType || !material || !reportHtml) {
      console.log("Missing required fields:", {
        atlId: !!atlId,
        testType: !!testType,
        material: !!material,
        reportHtml: !!reportHtml
      });
      return res.status(400).json({
        error: "Missing required fields: atlId, testType, material, and reportHtml",
      });
    }

    // Find the test with matching atlId, testType, AND material
    const testIndex = test.tests.findIndex(
      (t) =>
        t.atlId === atlId && t.testType === testType && t.material === material
    );
    console.log("Found test at index:", testIndex);

    if (testIndex === -1) {
      console.log("Test with ATL ID, test type, and material not found:", {
        atlId,
        testType,
        material,
      });
      return res.status(404).json({
        error: `Test with ATL ID ${atlId}, type ${testType}, and material ${material} not found`,
      });
    }

    // Store the report HTML in the reporturl field without changing status
    test.tests[testIndex].reporturl = reportHtml;

    // Mark the tests array as modified to ensure MongoDB saves the changes
    test.markModified("tests");

    // Save the document and verify the save was successful
    const savedTest = await test.save();
    console.log("Test document saved successfully");

    // Verify the report was saved
    const verifyTest = await MaterialTest.findById(req.params.id);
    const verifyTestIndex = verifyTest.tests.findIndex(
      (t) =>
        t.atlId === atlId && t.testType === testType && t.material === material
    );

    if (
      verifyTestIndex === -1 ||
      !verifyTest.tests[verifyTestIndex].reporturl
    ) {
      console.error("Report was not saved correctly. Verification failed.");
      return res
        .status(500)
        .json({ error: "Failed to save report. Verification failed." });
    }

    console.log(
      "Report verification successful. Report length:",
      verifyTest.tests[verifyTestIndex].reporturl.length
    );

    res.json({ ok: true, test: savedTest });
  } catch (error) {
    console.error("Error editing report:", error);
    res.status(500).json({ error: error.message });
  }
});

// Send individual report for approval
router.post("/:id/report/send-individual", async (req, res) => {
  try {
    console.log("Sending individual report for approval...");
    const test = await MaterialTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const { atlId, testType, material } = req.body;
    console.log("Request body:", { atlId, testType, material });

    // Find the specific test
    const testIndex = test.tests.findIndex(
      (t) =>
        t.atlId === atlId && t.testType === testType && t.material === material
    );

    if (testIndex === -1) {
      return res.status(404).json({ error: "Specific test not found" });
    }

    // Allow sending for approval if report was previously rejected (testReportApproval === -1)
    // or if it's a new report being sent for the first time
    if (test.tests[testIndex].testReportApproval !== -1 && test.tests[testIndex].testReportApproval !== undefined && test.tests[testIndex].testReportApproval !== 0) {
      return res.status(400).json({
        error: "Only rejected or new reports can be sent for approval",
      });
    }

    console.log(
      "Current test report approval status:",
      test.tests[testIndex].testReportApproval
    );

    // Update individual report approval status
    test.tests[testIndex].testReportApproval = 1; // Set to "Sent for approval"
    console.log(
      "Updated test report approval status to",
      test.tests[testIndex].testReportApproval
    );

    // Check if all reports are sent for approval
    const allReportsSentForApproval = test.tests.every(
      (t) => t.testReportApproval === 1
    );
    console.log("All reports sent for approval:", allReportsSentForApproval);

    if (allReportsSentForApproval) {
      test.status = "Report Sent for Approval";
    }

    // Mark the tests array as modified
    test.markModified("tests");

    // Save the changes
    await test.save();
    console.log("Changes saved successfully");

    // Verify the update
    const updatedTest = await MaterialTest.findById(req.params.id);
    const updatedTestIndex = updatedTest.tests.findIndex(
      (t) =>
        t.atlId === atlId && t.testType === testType && t.material === material
    );
    console.log(
      "Verification - Updated test report approval status:",
      updatedTest.tests[updatedTestIndex].testReportApproval
    );

    res.json({
      ok: true,
      test: updatedTest,
      testReportApproval:
        updatedTest.tests[updatedTestIndex].testReportApproval,
    });
  } catch (error) {
    console.error("Error sending report for approval:", error);
    res.status(500).json({ error: error.message });
  }
});

// Approve individual report
router.post("/:id/report/approve-individual", async (req, res) => {
  try {
    const test = await MaterialTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const { atlId, testType, material } = req.body;

    // Find the specific test
    const testIndex = test.tests.findIndex(
      (t) =>
        t.atlId === atlId && t.testType === testType && t.material === material
    );

    if (testIndex === -1) {
      return res.status(404).json({ error: "Specific test not found" });
    }

    // Update individual report approval status
    test.tests[testIndex].testReportApproval = 2; // Set to "Approved"

    // Check if all reports are approved
    const allReportsApproved = test.tests.every(
      (t) => t.testReportApproval === 2
    );
    if (allReportsApproved) {
      test.status = "Report Approved";
    }

    test.markModified("tests");
    await test.save();

    res.json({ ok: true, test });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject individual report
router.post("/:id/report/reject-individual", async (req, res) => {
  try {
    const test = await MaterialTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const { atlId, testType, material, remark } = req.body;

    if (!remark?.trim()) {
      return res.status(400).json({ error: "Rejection remark is required" });
    }

    // Find the specific test
    const testIndex = test.tests.findIndex(
      (t) =>
        t.atlId === atlId && t.testType === testType && t.material === material
    );

    if (testIndex === -1) {
      return res.status(404).json({ error: "Specific test not found" });
    }

    // Update individual report approval status and add remark
    test.tests[testIndex].testReportApproval = -1; // Set to "Rejected"
    test.tests[testIndex].reportRemark = remark.trim();

    // If any report is rejected, update overall status
    test.status = "Report Rejected";

    test.markModified("tests");
    await test.save();

    res.json({ ok: true, test });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get reports pending approval
router.get("/reports/pending-approval", async (req, res) => {
  try {
    console.log("Fetching reports pending approval...");

    // Find all tests that have at least one report with approval status
    const tests = await MaterialTest.find({
      "tests.testReportApproval": { $in: [1, 2, -1] },
    });

    // For each test, only include the reports that have an approval status
    const filteredTests = tests.map((test) => ({
      ...test.toObject(),
      tests: test.tests.filter((t) =>
        [1, 2, -1].includes(t.testReportApproval)
      ),
    }));

    console.log(`Found ${filteredTests.length} tests with reports`);

    res.json({
      ok: true,
      tests: filteredTests,
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({
      ok: false,
      error: error.message || "Failed to fetch reports",
    });
  }
});

// Add this route to get complete report data
router.get("/:id/report-data", async (req, res) => {
  try {
    console.log("Fetching complete report data for ID:", req.params.id);
    
    const test = await MaterialTest.findById(req.params.id)
      .populate('clientId', 'clientname emailid contactno address');

    if (!test) {
      return res.status(404).json({
        error: "Test not found",
        ok: false
      });
    }

    // Transform the data into a complete report object
    const reportData = {
      _id: test._id,
      testId: test.testId,
      clientName: test.clientId?.clientname || test.clientName,
      emailId: test.clientId?.emailid || test.emailId,
      contactNo: test.clientId?.contactno || test.contactNo,
      address: test.clientId?.address || test.address,
      date: test.date,
      status: test.status,
      tests: test.tests.map(t => ({
        atlId: t.atlId,
        material: t.material,
        materialId: t.materialId,
        testType: t.testType,
        date: t.date,
        completionDate: t.completionDate,
        equipmenttable: t.equipmenttable,
        resulttable: t.resulttable,
        reporturl: t.reporturl,
        testReportApproval: t.testReportApproval,
        tests: t.tests
      }))
    };

    res.json({
      ok: true,
      reportData
    });
  } catch (error) {
    console.error("Error fetching report data:", error);
    res.status(500).json({
      error: "Failed to fetch report data",
      ok: false
    });
  }
});

export default router;
