export class PhoneFormatter {
	static format(phoneNumber) {
		if (!phoneNumber) return '';
		
		const cleaned = phoneNumber.replace(/\D/g, '');
		
		if (cleaned.length === 11 && cleaned.startsWith('1')) {
			const areaCode = cleaned.slice(1, 4);
			const prefix = cleaned.slice(4, 7);
			const suffix = cleaned.slice(7, 11);
			return `+1 ${areaCode}-${prefix}-${suffix}`;
		}
		
		if (cleaned.length === 10) {
			const areaCode = cleaned.slice(0, 3);
			const prefix = cleaned.slice(3, 6);
			const suffix = cleaned.slice(6, 10);
			return `+1 ${areaCode}-${prefix}-${suffix}`;
		}
		
		return phoneNumber;
	}

	static normalize(phoneNumber) {
		if (!phoneNumber) return '';
		const cleaned = phoneNumber.replace(/\D/g, '');
		
		if (cleaned.length === 11 && cleaned.startsWith('1')) {
			return `+${cleaned}`;
		}
		
		if (cleaned.length === 10) {
			return `+1${cleaned}`;
		}
		
		return phoneNumber;
	}
}
