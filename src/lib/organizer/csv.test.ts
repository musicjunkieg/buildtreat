import { describe, expect, it } from 'vitest';
import { registrationsCsv } from './csv';

describe('registrationsCsv', () => {
	it('emits the header and a flattened row', () => {
		const csv = registrationsCsv([
			{
				did: 'did:plc:a', handle: 'a.test', name: 'A, B', email: 'a@x.com', status: 'confirmed', phone: '1',
				emergencyName: 'E', emergencyPhone: '2', dietary: ['vegan', 'kosher'], dietaryOther: '', accessibility: 'ramp',
				notes: '', travelArrival: 'Fri', travelDeparture: 'Mon', travelMode: 'flying', travelDetails: '',
				waiverVersion: 'v1', cocVersion: 'v1', agreedAt: '2026-08-30T00:00:00Z', createdAt: 'c', updatedAt: 'u'
			}
		]);
		const [header, row] = csv.trim().split('\r\n');
		expect(header).toBe('handle,did,name,email,status,registered,phone,emergency_name,emergency_phone,dietary,dietary_other,accessibility,notes,travel_mode,travel_arrival,travel_departure,travel_details,waiver_version,coc_version,agreed_at,updated_at');
		expect(row).toBe('a.test,did:plc:a,"A, B",a@x.com,confirmed,yes,1,E,2,vegan; kosher,,ramp,,flying,Fri,Mon,,v1,v1,2026-08-30T00:00:00Z,u');
	});
});
