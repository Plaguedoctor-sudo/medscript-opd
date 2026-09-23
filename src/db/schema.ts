import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const patients = sqliteTable("patients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  gender: text("gender").notNull(), // Male, Female, Other
  phone: text("phone"),
  abhaId: text("abha_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const patientsRelations = relations(patients, ({ many }) => ({
  prescriptions: many(prescriptions),
}));

export const prescriptions = sqliteTable("prescriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patients.id),
  
  // Vitals
  weight: text("weight"),
  bp: text("bp"),
  pulse: text("pulse"),
  temp: text("temp"),
  spo2: text("spo2"),

  // Clinical Info
  chiefComplaints: text("chief_complaints"),
  clinicalHistory: text("clinical_history"),
  diagnosis: text("diagnosis"),
  
  // Medications (Stored as JSON string for simplicity in this MVP)
  // Format: [{ name: string, strength: string, dosage: string, timing: string, duration: string }]
  medications: text("medications").notNull(), 
  
  advice: text("advice"),
  labTests: text("lab_tests"),
  followUpDate: text("follow_up_date"),
  
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const prescriptionsRelations = relations(prescriptions, ({ one }) => ({
  patient: one(patients, {
    fields: [prescriptions.patientId],
    references: [patients.id],
  }),
}));

export const clinicSettings = sqliteTable("clinic_settings", {
  id: integer("id").primaryKey().$default(() => 1), // Only one row
  doctorName: text("doctor_name").notNull(),
  qualifications: text("qualifications").notNull(),
  regNumber: text("reg_number").notNull(),
  clinicName: text("clinic_name").notNull(),
  address: text("address").notNull(),
  contact: text("contact").notNull(),
  logoUrl: text("logo_url"),
});
