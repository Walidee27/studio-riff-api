export interface Room {
  id: string;
  name: string;
  capacity: number;
  maintenanceStart: Date | null;
  maintenanceEnd: Date | null;
}
