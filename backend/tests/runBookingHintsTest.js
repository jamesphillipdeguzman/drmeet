import { getBookingHints } from '../src/controllers/appointment.controller.js';
import Doctor from '../src/models/doctor.model.js';
import Appointment from '../src/models/appointment.model.js';
import assert from 'assert';

console.log('--- RUNNING BOOKING HINTS & 30-MIN INTERVAL TESTS ---');

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
    const futureSaturday = '2028-06-17';

    const doctorMock = {
        _id: validDoctorId,
        firstName: 'Carmel',
        lastName: 'Doctor',
        availabilityText: 'Saturday 10:00 AM - 12:00 PM',
        bookingPolicy: { maxPatientsPerDay: 10 },
    };

    Doctor.findById = () => ({
        select: () => ({
            lean: async () => doctorMock,
        }),
        lean: async () => doctorMock,
    });

    Appointment.find = () => ({
        select: () => ({
            lean: async () => [],
        }),
    });

    const { req: req1, res: res1, getResult: getResult1 } = createMockReqRes({
        doctorId: validDoctorId,
        date: futureSaturday,
    });

    await getBookingHints(req1, res1);
    const result1 = getResult1();
    if (result1.statusCode !== 200) {
        console.error('Test 1 Returned Status:', result1.statusCode, 'Body:', result1.body);
    }

    assert.strictEqual(result1.statusCode, 200, 'Status should be 200');
    assert(Array.isArray(result1.body.suggestedAvailableTimes), 'suggestedAvailableTimes should be an array');
    assert.deepStrictEqual(result1.body.suggestedAvailableTimes, ['10:00', '10:30', '11:00', '11:30'], 'Should return 30-min slots for Dra. Carmel on Saturday');
    console.log('✅ Test 1 Passed: Booking hints successfully fetched for Dra. Carmel on Saturday with 30-min slots:', result1.body.suggestedAvailableTimes);

    const futureMonday = '2028-06-19';
    const { req: req2, res: res2, getResult: getResult2 } = createMockReqRes({
        doctorId: validDoctorId,
        date: futureMonday,
    });

    await getBookingHints(req2, res2);
    const result2 = getResult2();

    assert.strictEqual(result2.statusCode, 200, 'Status should be 200');
    assert.deepStrictEqual(result2.body.suggestedAvailableTimes, [], 'Should return 0 slots for off-day');
    assert.strictEqual(result2.body.remainingSlots, 0, 'Remaining slots should be 0');
    console.log('✅ Test 2 Passed: Doctor off-day correctly returns 0 available slots');

    const { req: req3, res: res3, getResult: getResult3 } = createMockReqRes({
        doctorId: '',
        date: '',
    });

    await getBookingHints(req3, res3);
    const result3 = getResult3();

    assert.strictEqual(result3.statusCode, 200, 'Status should be 200 for fallback');
    assert.strictEqual(result3.body.hint, 'Select a valid doctor and date to view availability.');
    console.log('✅ Test 3 Passed: Missing parameters handled gracefully with 200 OK fallback');

    console.log('\n--- ALL BOOKING HINTS & 30-MIN INTERVAL TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch((err) => {
    console.error('❌ Test Failed:', err);
    process.exit(1);
});
