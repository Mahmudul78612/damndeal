const mongoose = require("mongoose");

// Atomic auto-increment sequences for human-friendly numbers
// (WO-2001, INV-3001, PO-1001, LEAD-..., APPT-...).
const counterSchema = new mongoose.Schema({
  _id: { type: String }, // sequence name e.g. "workOrder"
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", counterSchema);

// Returns the next number for a sequence, starting at `start`.
async function nextSeq(name, start = 1) {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  // If first time, jump to `start`
  if (doc.seq < start) {
    const fixed = await Counter.findByIdAndUpdate(name, { $set: { seq: start } }, { new: true });
    return fixed.seq;
  }
  return doc.seq;
}

// Formatted number e.g. formatNumber("WO", 2001) => "WO-2001"
function formatNumber(prefix, seq) {
  return `${prefix}-${seq}`;
}

module.exports = { Counter, nextSeq, formatNumber };
