'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Patient } from "@/types";
import { updatePatient } from "@/app/prescription/new/actions";
import { toast } from "@/components/ui/toast";
import { Edit, Loader2 } from "lucide-react";

export function EditPatientModal({ patient }: { patient: Patient }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState(patient.name);
  const [age, setAge] = useState(String(patient.age));
  const [gender, setGender] = useState(patient.gender);
  const [phone, setPhone] = useState(patient.phone || "");
  const [abhaId, setAbhaId] = useState(patient.abhaId || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updatePatient(patient.id, {
        name,
        age: parseInt(age, 10),
        gender,
        phone: phone || null,
        abhaId: abhaId || null,
      });

      toast.show({
        title: "Patient Updated",
        description: "Patient profile has been updated successfully.",
        type: "success",
      });
      setOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update patient details.";
      toast.show({
        title: "Error",
        description: msg,
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
        <Edit className="w-3.5 h-3.5" /> Edit Patient
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Patient Details</DialogTitle>
            <DialogDescription>
              Update demographic and contact details for {patient.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Full Name *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Patient Full Name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-age">Age (Years) *</Label>
                <Input
                  id="edit-age"
                  type="number"
                  min="0"
                  max="150"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-gender">Gender *</Label>
                <select
                  id="edit-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-300 rounded-md bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">Contact Phone</Label>
              <Input
                id="edit-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-abha">ABHA ID (Ayushman Bharat)</Label>
              <Input
                id="edit-abha"
                value={abhaId}
                onChange={(e) => setAbhaId(e.target.value)}
                placeholder="14-digit ABHA Number"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
