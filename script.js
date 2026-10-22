(function () {
    const list = document.getElementById('productList');
    const template = list.querySelector('.product-card').cloneNode(true);

    function renumber() {
        const cards = list.querySelectorAll('.product-card');
        list.classList.toggle('multiple', cards.length > 1);
        cards.forEach((card, i) => {
            const n = i + 1;
            card.dataset.index = n;
            card.querySelector('.product-label').textContent = 'Product ' + n;
            card.querySelectorAll('[name]').forEach(el => {
                el.name = el.name.replace(/_\d+$/, '_' + n);
            });
        });
    }

    // Remove any product (works for Product 1 too, once there are 2+)
    list.addEventListener('click', (e) => {
        const btn = e.target.closest('.remove-btn');
        if (!btn) return;
        if (list.querySelectorAll('.product-card').length <= 1) return;
        btn.closest('.product-card').remove();
        renumber();
    });

    document.getElementById('addItem').addEventListener('click', () => {
        const card = template.cloneNode(true);
        card.querySelectorAll('input, textarea').forEach(el => {
            el.value = el.type === 'number' ? 1 : '';
        });
        card.querySelector('select').selectedIndex = 0;
        list.appendChild(card);
        renumber();
    });

    renumber();
})();

/* ============================================================
   AZURE FUNCTION SUBMISSION
   The URL comes from the form's action="" attribute.
   ============================================================ */
const AZURE_FUNCTION_URL = document.getElementById('returnForm').action;

// Sent with every submission
const FORM_BRAND = 'OOKA';
const FORM_LANGUAGE = 'English';

(function () {
    const form = document.getElementById('returnForm');
    const submitBtn = document.getElementById('submitBtn');
    const statusBox = document.getElementById('formStatus');

    function showStatus(type, msg) {
        statusBox.className = 'form-status ' + type;
        statusBox.textContent = msg;
    }

    function clearStatus() {
        statusBox.className = 'form-status';
        statusBox.textContent = '';
    }

    // Validate required fields and email format
    function validate() {
        let firstInvalid = null;
        form.querySelectorAll('input, select, textarea').forEach(el => {
            const field = el.closest('.field');
            if (!field) return;
            let errorEl = field.querySelector('.error-text');
            if (!errorEl) {
                errorEl = document.createElement('div');
                errorEl.className = 'error-text';
                field.appendChild(errorEl);
            }

            let message = '';
            const value = (el.value || '').trim();
            if (el.required && !value) message = 'This field is required.';
            else if (el.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) message = 'Please enter a valid email.';
            else if (el.type === 'number' && value && Number(value) < 1) message = 'Must be at least 1.';

            field.classList.toggle('invalid', !!message);
            errorEl.textContent = message;
            if (message && !firstInvalid) firstInvalid = el;
        });

        if (firstInvalid) {
            firstInvalid.focus();
            return false;
        }
        return true;
    }

    // Clear a field's error as soon as the user fixes it
    form.addEventListener('input', e => {
        const field = e.target.closest('.field');
        if (field) field.classList.remove('invalid');
    });
    form.addEventListener('change', e => {
        const field = e.target.closest('.field');
        if (field) field.classList.remove('invalid');
    });

    // Read every field in the Hidden Fields section by its LABEL,
    // so ids/names can be anything. "Lead Form Language" -> leadFormLanguage
    function getHiddenFields() {
        const out = {};
        document.querySelectorAll('.hidden-section .field').forEach(field => {
            const label = field.querySelector('label');
            const input = field.querySelector('input, select, textarea');
            if (!label || !input) return;
            const key = label.textContent.trim().toLowerCase()
                .replace(/[^a-z0-9]+(.)/g, (m, c) => c.toUpperCase())
                .replace(/[^a-zA-Z0-9]/g, '');
            if (key) out[key] = (input.value || '').trim();
        });
        return out;
    }

    // Build the JSON payload sent to Azure
    function buildPayload() {
        // Safe lookup: a missing id gives '' instead of crashing
        const val = id => {
            const el = document.getElementById(id);
            return el ? (el.value || '').trim() : '';
        };
        const products = [...document.querySelectorAll('#productList .product-card')].map((card, i) => ({
            lineNumber: i + 1,
            productName: card.querySelector('[name^="ProductName_"]').value.trim(),
            quantity: parseInt(card.querySelector('[name^="Quantity_"]').value, 10) || 1,
            reasonForReturn: card.querySelector('[name^="Reason_"]').value,
            description: card.querySelector('[name^="Description_"]').value.trim()
        }));

        return {
            submittedAt: new Date().toISOString(),
            brand: FORM_BRAND,
            language: FORM_LANGUAGE,
            ...getHiddenFields(),
            contact: {
                firstName: val('firstName'),
                lastName: val('lastName'),
                phone: val('phone'),
                email: val('email')
            },
            order: {
                orderNumber: val('orderNumber')
            },
            products: products
        };
    }

    console.log('Return form script loaded. Posting to:', AZURE_FUNCTION_URL);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearStatus();
        if (!validate()) {
            showStatus('error', 'Please fill in all required fields marked with *.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting…';

        try {
            const payload = buildPayload();
            console.log('Sending payload:', payload);
            const res = await fetch(AZURE_FUNCTION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error('Server responded with ' + res.status + (text ? ': ' + text : ''));
            }

            showStatus('success', 'Thank you! Your return request has been submitted.');
            form.reset();

            // Reset to a single product
            const cards = document.querySelectorAll('#productList .product-card');
            cards.forEach((c, i) => { if (i > 0) c.remove(); });
            document.getElementById('productList').classList.remove('multiple');
        } catch (err) {
            console.error('Return form submission failed:', err);
            const reason = (err instanceof TypeError)
                ? 'Could not reach the server (network or CORS issue).'
                : err.message;
            showStatus('error', 'Sorry, something went wrong while submitting. ' + reason);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
        }
    });
})();