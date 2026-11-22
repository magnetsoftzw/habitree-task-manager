import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const PasswordInput = ({ id, value, onChange, autoComplete, placeholder, invalid, describedBy }) => {
    const [shown, setShown] = useState(false);
    return (
        <div className="auth-pw">
            <input
                id={id}
                className="auth-input"
                type={shown ? 'text' : 'password'}
                autoComplete={autoComplete}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-invalid={invalid}
                aria-describedby={describedBy}
            />
            <button type="button" className="auth-pw-toggle" aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown} onClick={() => setShown((v) => !v)}>
                {shown ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
        </div>
    );
};

export default PasswordInput;
