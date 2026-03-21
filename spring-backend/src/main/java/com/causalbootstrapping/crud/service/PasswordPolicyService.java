package com.causalbootstrapping.crud.service;

import com.causalbootstrapping.crud.config.ApplicationProperties;
import com.causalbootstrapping.crud.error.ApiException;
import org.springframework.stereotype.Service;

@Service
public class PasswordPolicyService {
    private final ApplicationProperties properties;

    public PasswordPolicyService(ApplicationProperties properties) {
        this.properties = properties;
    }

    public void validateForSignup(String email, String password) {
        String normalizedPassword = password == null ? "" : password.trim();
        int minLength = properties.getSignupPasswordMinLength();

        if (normalizedPassword.length() < minLength) {
            throw new ApiException(400, "Password must be at least " + minLength + " characters long.");
        }
        if (normalizedPassword.chars().noneMatch(Character::isLetter)) {
            throw new ApiException(400, "Password must include at least one letter.");
        }
        if (normalizedPassword.chars().noneMatch(Character::isDigit)) {
            throw new ApiException(400, "Password must include at least one digit.");
        }
        if (normalizedPassword.chars().allMatch(character -> Character.isLetterOrDigit(character) || Character.isWhitespace(character))) {
            throw new ApiException(400, "Password must include at least one symbol.");
        }
        if (allCharactersIdentical(normalizedPassword)) {
            throw new ApiException(400, "Password cannot be the same character repeated.");
        }

        String emailLocalPart = extractEmailLocalPart(email);
        if (emailLocalPart != null && emailLocalPart.length() >= 4) {
            String loweredPassword = normalizedPassword.toLowerCase();
            if (loweredPassword.contains(emailLocalPart)) {
                throw new ApiException(400, "Password cannot contain the email name.");
            }
        }
    }

    private boolean allCharactersIdentical(String value) {
        if (value.isEmpty()) {
            return false;
        }
        char first = value.charAt(0);
        for (int index = 1; index < value.length(); index += 1) {
            if (value.charAt(index) != first) {
                return false;
            }
        }
        return true;
    }

    private String extractEmailLocalPart(String email) {
        if (email == null) {
            return null;
        }
        int atIndex = email.indexOf('@');
        if (atIndex <= 0) {
            return null;
        }
        return email.substring(0, atIndex).trim().toLowerCase();
    }
}
