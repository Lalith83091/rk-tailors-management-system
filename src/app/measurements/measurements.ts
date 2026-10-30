import { Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Customer, MeasurementProfile, MeasurementVersion } from '../core/models';
import { ShopDataService } from '../core/shop-data.service';
import { NotificationService } from '../shared/notification.service';
import { localDateString } from '../core/local-date';

const FIELD_SETS: Record<string, Array<[string, string]>> = {
  Shirt: [['chest', 'Chest'], ['waist', 'Waist'], ['shoulder', 'Shoulder'], ['shirt_length', 'Shirt length'], ['sleeve_length', 'Sleeve length'], ['collar', 'Collar'], ['cuff', 'Cuff'], ['biceps', 'Biceps']],
  Pant: [['waist', 'Waist'], ['hip', 'Hip'], ['length', 'Length'], ['inseam', 'Inseam'], ['thigh', 'Thigh'], ['knee', 'Knee'], ['bottom', 'Bottom']],
  Kurta: [['chest', 'Chest'], ['waist', 'Waist'], ['shoulder', 'Shoulder'], ['length', 'Length'], ['sleeve_length', 'Sleeve length'], ['neck', 'Neck']],
  Pajama: [['waist', 'Waist'], ['hip', 'Hip'], ['length', 'Length'], ['inseam', 'Inseam'], ['bottom', 'Bottom']],
  Suit: [['chest', 'Chest'], ['waist', 'Waist'], ['shoulder', 'Shoulder'], ['jacket_length', 'Jacket length'], ['sleeve_length', 'Sleeve length'], ['trouser_waist', 'Trouser waist'], ['trouser_length', 'Trouser length']],
  Blazer: [['chest', 'Chest'], ['waist', 'Waist'], ['shoulder', 'Shoulder'], ['length', 'Length'], ['sleeve_length', 'Sleeve length'], ['lapel', 'Lapel']],
  Sherwani: [['chest', 'Chest'], ['waist', 'Waist'], ['shoulder', 'Shoulder'], ['length', 'Length'], ['sleeve_length', 'Sleeve length'], ['neck', 'Neck']],
  Other: [['chest', 'Chest'], ['waist', 'Waist'], ['hip', 'Hip'], ['shoulder', 'Shoulder'], ['length', 'Length'], ['sleeve_length', 'Sleeve length']],
};
const MEASUREMENT_KEYS = [...new Set(Object.values(FIELD_SETS).flatMap((fields) => fields.map(([key]) => key)))];

@Component({
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  selector: 'app-measurements',
  templateUrl: './measurements.html',
})
export class MeasurementsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly shop = inject(ShopDataService);
  private readonly notifications = inject(NotificationService);
  readonly types = Object.keys(FIELD_SETS);
  readonly form = this.fb.group({
    customer_id: ['', Validators.required],
    garment_type: ['Shirt', Validators.required],
    unit: ['in' as 'in' | 'cm', Validators.required],
    fit_type: ['Regular'],
    measured_at: [localDateString(), Validators.required],
    notes: [''],
    ...Object.fromEntries(MEASUREMENT_KEYS.map((key) => [key, this.fb.control<number | null>(null, [Validators.min(0), Validators.max(500)])])),
  });
  customers: Customer[] = [];
  profiles: MeasurementProfile[] = [];
  versions: MeasurementVersion[] = [];
  customFields: Array<{ name: string; value: number | null }> = [];
  loading = true;
  saving = false;
  error = '';
  message = '';
  selectedType = 'Shirt';

  get fields(): Array<[string, string]> { return FIELD_SETS[this.selectedType] ?? FIELD_SETS['Other']; }

  customerName(id: string): string {
    return this.customers.find((customer) => customer.id === id)?.full_name ?? 'Customer';
  }

  versionSummary(values: Record<string, number>): string {
    return Object.entries(values).map(([key, value]) => `${key.replaceAll('_', ' ')} ${value}`).join(' · ');
  }

  async ngOnInit(): Promise<void> {
    try {
      [this.customers, this.profiles, this.versions] = await Promise.all([
        this.shop.customers(), this.shop.measurements(), this.shop.measurementVersions(),
      ]);
    } catch (error) {
      console.error('Measurement data could not be loaded', error);
      this.error = 'Could not load measurement records. Check Supabase configuration and migration status.';
    } finally { this.loading = false; }
  }

  changeType(type: string): void {
    this.selectedType = type;
    this.form.controls.garment_type.setValue(type);
    this.customFields = [];
  }

  changeUnit(unit: 'in' | 'cm'): void {
    const previousUnit = this.form.controls.unit.value;
    if (previousUnit && previousUnit !== unit) {
      const factor = unit === 'cm' ? 2.54 : 1 / 2.54;
      for (const [key] of this.fields) {
        const control = this.form.get(key);
        if (typeof control?.value === 'number') control.setValue(Number((control.value * factor).toFixed(1)));
      }
      this.customFields = this.customFields.map((field) => ({
        ...field,
        value: field.value === null ? null : Number((field.value * factor).toFixed(1)),
      }));
    }
    this.form.controls.unit.setValue(unit);
  }

  addCustomField(): void { this.customFields.push({ name: '', value: null }); }

  updateCustomField(index: number, field: 'name' | 'value', event: Event): void {
    const target = event.target as HTMLInputElement;
    if (field === 'name') this.customFields[index].name = target.value;
    else this.customFields[index].value = target.value === '' ? null : Number(target.value);
  }

  editLatest(profile: MeasurementProfile): void {
    this.selectedType = profile.garment_type;
    for (const [key] of Object.values(FIELD_SETS).flat()) this.form.get(key)?.reset(null, { emitEvent: false });
    this.customFields = [];
    this.form.patchValue({
      customer_id: profile.customer_id,
      garment_type: profile.garment_type,
      unit: profile.unit,
      fit_type: profile.fit_type ?? 'Regular',
      measured_at: localDateString(),
      notes: profile.notes ?? '',
    });
    const standardKeys = new Set(this.fields.map(([key]) => key));
    for (const [key, value] of Object.entries(profile.measurements)) {
      if (standardKeys.has(key)) this.form.get(key)?.setValue(value);
    }
    this.customFields = Object.entries(profile.measurements)
      .filter(([key]) => !standardKeys.has(key))
      .map(([name, value]) => ({ name, value }));
    this.message = `Loaded version ${profile.version}. Saving will create a new version without changing historical records.`;
    this.error = '';
  }

  copyPrevious(): void {
    const customerId = this.form.controls.customer_id.value;
    const previous = this.profiles.find((item) => item.customer_id === customerId && item.garment_type === this.selectedType);
    if (!previous) { this.error = 'No previous measurements exist for this customer and garment.'; return; }
    this.editLatest(previous);
    this.form.controls.unit.setValue(previous.unit);
    this.form.controls.fit_type.setValue(previous.fit_type ?? 'Regular');
    this.message = `Copied version ${previous.version}; saving creates a new historical version.`;
    this.error = '';
  }

  async save(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    this.error = '';
    try {
      const raw = this.form.getRawValue();
      const measurements: Record<string, number> = {};
      for (const [key] of this.fields) {
        const value = this.form.get(key)?.value;
        if (value !== null && value !== undefined) measurements[key] = Number(value);
      }
      for (const field of this.customFields) {
        const key = field.name.trim().toLowerCase().replace(/[^a-z0-9_ -]/g, '').replaceAll(' ', '_');
        if (key && field.value !== null) {
          if (!Number.isFinite(field.value) || field.value < 0 || measurements[key] !== undefined) {
            this.error = 'Custom measurements must have unique names and non-negative numeric values.';
            this.saving = false;
            return;
          }
          measurements[key] = field.value;
        }
      }
      if (!Object.keys(measurements).length) {
        this.error = 'Enter at least one measurement.';
        this.saving = false;
        return;
      }
      await this.shop.saveMeasurements({
        customer_id: raw.customer_id!,
        garment_type: this.selectedType,
        unit: raw.unit as 'in' | 'cm',
        measurements,
        fit_type: raw.fit_type,
        notes: raw.notes,
        measured_at: raw.measured_at!,
      });
      this.message = 'Measurements saved as a new version. Existing order snapshots remain unchanged.';
      this.notifications.show('New measurement version saved.');
      this.customFields = [];
      this.form.reset({ customer_id: raw.customer_id, garment_type: this.selectedType, unit: raw.unit as 'in' | 'cm', fit_type: raw.fit_type, measured_at: localDateString(), notes: '' });
      try {
        [this.profiles, this.versions] = await Promise.all([this.shop.measurements(), this.shop.measurementVersions()]);
      } catch (error) {
        console.error('Measurements saved but the history could not be refreshed', error);
        this.error = 'Measurements saved, but history could not be refreshed. Reload the page to confirm the new version.';
        this.notifications.show(this.error, 'error');
      }
    } catch (error) {
      console.error('Measurements could not be saved', error);
      this.error = 'Could not save measurements.';
      this.notifications.show(this.error, 'error');
    } finally { this.saving = false; }
  }
}
