package com.platform.chatservice.controller;

import com.platform.chatservice.dto.ReminderResponse;
import com.platform.chatservice.model.Reminder;
import com.platform.chatservice.repository.ReminderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;

@RestController
@RequestMapping("/api/reminders")
@RequiredArgsConstructor
public class ReminderController {

    private final ReminderRepository reminderRepository;

    @GetMapping
    public List<ReminderResponse> getReminders(Authentication auth) {
        String userId = auth.getName();
        return reminderRepository.findByUserIdAndDoneFalseOrderByRemindAtAsc(userId)
            .stream()
            .map(this::toResponse)
            .toList();
    }

    @PatchMapping("/{id}/done")
    public ResponseEntity<ReminderResponse> markDone(
            @PathVariable String id,
            Authentication auth) {
        String userId = auth.getName();
        Reminder reminder = reminderRepository.findByIdAndUserId(id, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        reminder.setDone(true);
        reminderRepository.save(reminder);
        return ResponseEntity.ok(toResponse(reminder));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteReminder(
            @PathVariable String id,
            Authentication auth) {
        String userId = auth.getName();
        reminderRepository.findByIdAndUserId(id, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        reminderRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private ReminderResponse toResponse(Reminder r) {
        return new ReminderResponse(
            r.getId(),
            r.getUserId(),
            r.getConversationId(),
            r.getText(),
            r.getRemindAt(),
            r.isDone(),
            r.getCreatedAt()
        );
    }
}
