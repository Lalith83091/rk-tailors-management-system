export type OrderStatus =
  | 'New'
  | 'Cutting'
  | 'Stitching'
  | 'Trial'
  | 'Ready'
  | 'Delivered'
  | 'Cancelled';

export type PaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Other';

export interface Customer {
  id: string;
  customer_number: string;
  full_name: string;
  mobile_number: string;
  alternate_number: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  archived_at: string | null;
}

export interface MeasurementProfile {
  id: string;
  customer_id: string;
  garment_type: string;
  unit: 'in' | 'cm';
  measurements: Record<string, number>;
  fit_type: string | null;
  notes: string | null;
  measured_at: string;
  version: number;
}

export interface MeasurementVersion {
  id: string;
  profile_id: string;
  version: number;
  unit: 'in' | 'cm';
  measurements: Record<string, number>;
  fit_type: string | null;
  notes: string | null;
  measured_at: string;
  created_at: string;
  profile: Pick<MeasurementProfile, 'customer_id' | 'garment_type'>;
}

export interface OrderItemInput {
  garment_type: string;
  quantity: number;
  stitching_charge: number;
  measurement_snapshot: Record<string, unknown>;
}

export interface ShopOrder {
  id: string;
  order_number: string;
  customer_id: string;
  order_date: string;
  expected_delivery_date: string;
  status: OrderStatus;
  special_instructions: string | null;
  notes: string | null;
  discount: number;
  total_amount: number;
  advance_amount: number;
  created_at: string;
  customer?: Pick<Customer, 'full_name' | 'mobile_number'> & { address?: string | null };
  order_items?: Array<{
    id: string;
    garment_type: string;
    quantity: number;
    stitching_charge: number;
    measurement_snapshot: Record<string, unknown>;
  }>;
  payments?: Array<{
    id: string;
    amount: number;
    method: PaymentMethod;
    paid_at: string;
    reference: string | null;
  }>;
}

export interface PaymentInput {
  order_id: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
}
