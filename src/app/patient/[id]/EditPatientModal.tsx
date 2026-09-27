'use client'

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { updatePatient, deletePatient } from "@/app/prescription/new/actions";
import { toast } from "@/components/ui/toast";
import { Edit, Loader2, Trash2, AlertTriangle } from "lucide-react";

export function EditPatientModal({
  patient,
  triggerButton,
}: {
  patient: Patient;
  triggerButton?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [name, setName] = useState(patient.name);
  const [age, setAge] = useState(String(patient.age));
  const [gender, setGender] = useState(patient.gender);
  const [phone, setPhone] = useState(patient.phone || "");
  const [abhaId, setAbhaId] = useState(patient.abhaId || "");
  const [bloodGroup, setBloodGroup] = useState(patient.bloodGroup || "");
  const [allergies, setAllergies] = useState(patient.allergies || "");
  const [abhaAddress, setAbhaAddress] = useState(patient.abhaAddress || "");

  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete patient "${patient.name}" and all associated prescription history? This action cannot be undone.`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      await deletePatient(patient.id);
      toast.show({
        title: "Patient Deleted",
        description: `Patient record and history for ${patient.name} has been deleted.`,
        type: "info",
      });
      setOpen(false);
      router.push("/patients");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete patient.";
      toast.show({
        title: "Error",
        description: msg,
        type: "error",
      });
      setIsDeleting(false);
    }
  };

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
        allergies: allergies || null,
        bloodGroup: bloodGroup || null,
        abhaAddress: abhaAddress || null,
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
      <DialogTrigger render={triggerButton ? (triggerButton as React.ReactElement) : <Button variant="outline" size="sm" className="gap-1.5"><Edit className="w-3.5 h-3.5" /> Edit Patient</Button>} />
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Patient Details</DialogTitle>
            <DialogDescription>
              Update demographic and contact details for {patient.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {patient.regNo && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Registration No.</Label>
                  <span className="text-[10px] text-slate-400">Fixed System ID</span>
                </div>
                <Input
                  value={patient.regNo}
                  readOnly
                  className="bg-slate-50 font-mono text-xs text-slate-700 font-semibold"
                />
              </div>
            )}

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

            <div className="grid grid-cols-2 gap-3">
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
                <Label htmlFor="edit-blood-group">Blood Group</Label>
                <select
                  id="edit-blood-group"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-300 rounded-md bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value="">Unknown</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5 bg-rose-50/60 p-3 rounded-lg border border-rose-200">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-allergies" className="text-xs font-semibold text-rose-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Known Allergies / Contraindications
                </Label>
                <span className="text-[10px] text-rose-600 font-medium">Auto Safety Guard</span>
              </div>
              <Input
                id="edit-allergies"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="e.g. Penicillin, Sulfa, Paracetamol, Aspirin / NSAIDs"
                className="bg-white border-rose-300 focus:border-rose-500 text-sm"
              />
              <p className="text-[10px] text-rose-600">
                Prescriptions and admissions will instantly raise red cross-reactivity alerts when flagged drugs are added.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-abha">ABHA ID (Ayushman Bharat)</Label>
                <Input
                  id="edit-abha"
                  value={abhaId}
                  onChange={(e) => setAbhaId(e.target.value)}
                  placeholder="14-digit ABHA Number"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-abha-address">ABHA Address</Label>
                <Input
                  id="edit-abha-address"
                  value={abhaAddress}
                  onChange={(e) => setAbhaAddress(e.target.value)}
                  placeholder="e.g. user@abdm"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting || isSubmitting}
              className="text-red-600 hover:bg-red-50 hover:text-red-700 text-xs gap-1.5 self-start sm:self-auto"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete Patient
            </Button>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
                Cancel
              </DialogClose>
              <Button type="submit" size="sm" disabled={isSubmitting || isDeleting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
