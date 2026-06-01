package com.platform.chatservice.repository;

import com.platform.chatservice.model.Friendship;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.Optional;

public interface FriendshipRepository extends MongoRepository<Friendship, String> {

    /** Accepted friendship between two users in either direction, if any. */
    @Query("{ 'status': 'accepted', $or: [ "
        + "{ 'requesterId': ?0, 'recipientId': ?1 }, "
        + "{ 'requesterId': ?1, 'recipientId': ?0 } ] }")
    Optional<Friendship> findAcceptedBetween(String a, String b);
}
