// Sample Go code for testing analyzer
package main

import (
	"fmt"
	"strings"
)

// Constants
const (
	Version = "1.0.0"
	MaxConnections = 100
)

// User represents a system user
type User struct {
	ID       int
	Name     string
	Email    string
	IsActive bool
}

// UserService interface for user operations
type UserService interface {
	GetUser(id int) (*User, error)
	CreateUser(user User) error
	UpdateUser(user User) error
	DeleteUser(id int) error
}

// UserServiceImpl implements UserService
type UserServiceImpl struct {
	users map[int]*User
}

// NewUserService creates a new user service
func NewUserService() UserService {
	return &UserServiceImpl{
		users: make(map[int]*User),
	}
}

// GetUser retrieves a user by ID
func (s *UserServiceImpl) GetUser(id int) (*User, error) {
	user, exists := s.users[id]
	if !exists {
		return nil, fmt.Errorf("user not found: %d", id)
	}
	return user, nil
}

// CreateUser creates a new user
func (s *UserServiceImpl) CreateUser(user User) error {
	if _, exists := s.users[user.ID]; exists {
		return fmt.Errorf("user already exists: %d", user.ID)
	}
	s.users[user.ID] = &user
	return nil
}

// UpdateUser updates an existing user
func (s *UserServiceImpl) UpdateUser(user User) error {
	if _, exists := s.users[user.ID]; !exists {
		return fmt.Errorf("user not found: %d", user.ID)
	}
	s.users[user.ID] = &user
	return nil
}

// DeleteUser deletes a user by ID
func (s *UserServiceImpl) DeleteUser(id int) error {
	delete(s.users, id)
	return nil
}

// ProcessUsers processes a list of users concurrently
func ProcessUsers(users []User) {
	ch := make(chan User, len(users))

	// Start goroutines to process users
	for _, user := range users {
		go func(u User) {
			// Process user
			u.Name = strings.ToUpper(u.Name)
			ch <- u
		}(user)
	}

	// Collect results
	for i := 0; i < len(users); i++ {
		processed := <-ch
		fmt.Printf("Processed user: %s\n", processed.Name)
	}
}

// Embedded type example
type Admin struct {
	User // Embedding User struct
	Permissions []string
}

func main() {
	service := NewUserService()

	user := User{
		ID:       1,
		Name:     "John Doe",
		Email:    "john@example.com",
		IsActive: true,
	}

	if err := service.CreateUser(user); err != nil {
		fmt.Printf("Error creating user: %v\n", err)
		return
	}

	retrievedUser, err := service.GetUser(1)
	if err != nil {
		fmt.Printf("Error getting user: %v\n", err)
		return
	}

	fmt.Printf("User: %+v\n", retrievedUser)

	// Test goroutines
	users := []User{user}
	ProcessUsers(users)
}