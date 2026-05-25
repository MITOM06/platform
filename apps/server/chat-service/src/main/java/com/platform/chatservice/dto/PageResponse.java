package com.platform.chatservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record PageResponse<T>(
    List<T> content,
    int page,
    int size,
    long totalElements
) {
    @JsonProperty("hasNext")
    public boolean hasNext() {
        return (long) (page + 1) * size < totalElements;
    }
}
