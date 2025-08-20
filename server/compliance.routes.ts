// import express from 'express';
// const router = express.Router();

// // Compliance Fields Management
// let complianceFields = [
//   { name: "Filing Name", enabled: true },
//   { name: "Filing Frequency", enabled: true },
//   { name: "Compliance Category", enabled: true },
//   { name: "Governing Authority", enabled: true },
//   { name: "Start Date", enabled: true },
//   { name: "End Date", enabled: true },
//   { name: "Submission Deadline", enabled: true },
//   { name: "Submission Date", enabled: true },
//   { name: "Status", enabled: true },
//   { name: "Reminder Policy", enabled: true },
//   { name: "Remarks", enabled: true }
// ];

// // Get compliance fields configuration
// router.get('/fields', (req, res) => {
//   res.json(complianceFields);
// });

// // Update compliance fields configuration
// router.post('/fields', (req, res) => {
//   if (Array.isArray(req.body.fields)) {
//     complianceFields = req.body.fields;
//     res.json(complianceFields);
//   } else {
//     res.status(400).json({ error: 'Invalid fields data' });
//   }
// });

// export default router;
