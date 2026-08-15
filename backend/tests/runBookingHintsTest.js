import { getBookingHints } from '../src/controllers/appointment.controller.js';
import Doctor from '../src/models/doctor.model.js';
import Appointment from '../src/models/appointment.model.js';
import assert from 'assert';

console.log('--- RUNNING ENHANCED DOCTOR SCHEDULE PARSER TESTS ---');

function createMockReqRes({ doctorId, date, role = 'patient' }) {
    const req = {
        query: { doctorId, date },
        user: { _id: '507f1f77bcf86cd799439011', role },
    };
    let statusCode = 200;
    let jsonBody = null;
    const res = {
        status(code) {
            statusCode = code;
            return res;
        },
        json(data) {
            jsonBody = data;
            return res;
        },
    };
    return { req, res, getResult: () => ({ statusCode, body: jsonBody }) };
}

async function runTests() {
    const validDoctorId = '507f1f77bcf86cd799439011';

    // Test 1: Combined weekday/weekend pipe-separated string with typo colon ("Monday - Friday 08:00 - 11:00 | Saturday 09:00: 11:00")
    Doctor.findById = () => ({
        select: () => ({
            lean: async () => ({
                _id: validDoctorId,
                availabilityText: 'Monday - Friday 08:00 - 11:00 | Saturday 09:00: 11:00',
                bookingPolicy: { maxPatientsPerDay: 20 },
            }),
        }),
        lean: async () => ({
            _id: validDoctorId,
            availabilityText: 'Monday - Friday 08:00 - 11:00 | Saturday 09:00: 11:00',
            bookingPolicy: { maxPatientsPerDay: 20 },
        }),
    });
    Appointment.find = () => ({ select: () => ({ lean: async () => [] }) });

    // Test 1a: Saturday
    const satReq = createMockReqRes({ doctorId: validDoctorId, date: '2028-06-17' });
    await getBookingHints(satReq.req, satReq.res);
    assert.strictEqual(satReq.getResult().statusCode, 200);
    assert.deepStrictEqual(satReq.getResult().body.suggestedAvailableTimes, ['09:00', '09:30', '10:00', '10:30']);
    console.log('✅ Test 1a Passed: Pipe-separated Saturday schedule with typo colon parsed:', satReq.getResult().body.suggestedAvailableTimes);

    // Test 1b: Monday
    const monReq = createMockReqRes({ doctorId: validDoctorId, date: '2028-06-19' });
    await getBookingHints(monReq.req, monReq.res);
    assert.strictEqual(monReq.getResult().statusCode, 200);
    assert.deepStrictEqual(monReq.getResult().body.suggestedAvailableTimes, ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30']);
    console.log('✅ Test 1b Passed: Pipe-separated Monday-Friday block parsed:', monReq.getResult().body.suggestedAvailableTimes);

    // Test 2: Omitted AM/PM markers & implicit PM ("Monday - Friday 10:00 - 2:00")
    Doctor.findById = () => ({
        select: () => ({
            lean: async () => ({
                _id: validDoctorId,
                availabilityText: 'Monday - Friday 10:00 - 2:00',
                bookingPolicy: { maxPatientsPerDay: 20 },
            }),
        }),
        lean: async () => ({
            _id: validDoctorId,
            availabilityText: 'Monday - Friday 10:00 - 2:00',
            bookingPolicy: { maxPatientsPerDay: 20 },
        }),
    });

    const pmReq = createMockReqRes({ doctorId: validDoctorId, date: '2028-06-19' });
    await getBookingHints(pmReq.req, pmReq.res);
    assert.strictEqual(pmReq.getResult().statusCode, 200);
    expectTimeContains(pmReq.getResult().body.suggestedAvailableTimes, ['10:00', '11:00', '12:00', '13:00', '13:30']);
    console.log('✅ Test 2 Passed: Implicit AM/PM range (10:00 AM to 2:00 PM) parsed:', pmReq.getResult().body.suggestedAvailableTimes);

    // Test 3: Multi-shift day ("Monday - Friday 08:00 - 10:00 | Monday - Friday 14:00 - 16:00")
    Doctor.findById = () => ({
        select: () => ({
            lean: async () => ({
                _id: validDoctorId,
                availabilityText: 'Monday - Friday 08:00 - 10:00 | Monday - Friday 14:00 - 16:00',
                bookingPolicy: { maxPatientsPerDay: 20 },
            }),
        }),
        lean: async () => ({
            _id: validDoctorId,
            availabilityText: 'Monday - Friday 08:00 - 10:00 | Monday - Friday 14:00 - 16:00',
            bookingPolicy: { maxPatientsPerDay: 20 },
        }),
    });

    const shiftReq = createMockReqRes({ doctorId: validDoctorId, date: '2028-06-19' });
    await getBookingHints(shiftReq.req, shiftReq.res);
    assert.strictEqual(shiftReq.getResult().statusCode, 200);
    assert.deepStrictEqual(shiftReq.getResult().body.suggestedAvailableTimes, [
        '08:00', '08:30', '09:00', '09:30',
        '14:00', '14:30', '15:00', '15:30'
    ]);
    console.log('✅ Test 3 Passed: Multi-shift day parsed seamlessly:', shiftReq.getResult().body.suggestedAvailableTimes);

    console.log('\n--- ALL ENHANCED DOCTOR SCHEDULE PARSER TESTS PASSED! ---');
}

function expectTimeContains(actualList, expectedItems) {
    for (const item of expectedItems) {
        assert(actualList.includes(item), `Expected time list to contain ${item}, but got: ${JSON.stringify(actualList)}`);
    }
}

runTests().catch((err) => {
    console.error('❌ Test Failed:', err);
    process.exit(1);
});
