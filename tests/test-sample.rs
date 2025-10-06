use std::collections::HashMap;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct User {
    id: u64,
    name: String,
    email: String,
}

pub trait Repository<T> {
    fn get_by_id(&self, id: u64) -> Option<&T>;
    fn add(&mut self, entity: T);
}

pub struct UserRepository {
    users: HashMap<u64, User>,
}

impl UserRepository {
    pub fn new() -> Self {
        Self {
            users: HashMap::new(),
        }
    }

    pub async fn get_by_id_async(&self, id: u64) -> Option<User> {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        self.users.get(&id).cloned()
    }
}

impl Repository<User> for UserRepository {
    fn get_by_id(&self, id: u64) -> Option<&User> {
        self.users.get(&id)
    }

    fn add(&mut self, entity: User) {
        self.users.insert(entity.id, entity);
    }
}

pub enum UserRole {
    Admin,
    User,
    Guest,
}

pub struct UserService<'a> {
    repository: &'a mut UserRepository,
}

impl<'a> UserService<'a> {
    pub fn new(repository: &'a mut UserRepository) -> Self {
        Self { repository }
    }

    pub fn create_user(&mut self, name: String, email: String) -> User {
        let user = User {
            id: self.generate_id(),
            name,
            email,
        };
        self.repository.add(user.clone());
        user
    }

    fn generate_id(&self) -> u64 {
        // Simple ID generation
        (self.repository.users.len() + 1) as u64
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_repository() {
        let mut repo = UserRepository::new();
        let user = User {
            id: 1,
            name: "Test".to_string(),
            email: "test@example.com".to_string(),
        };
        repo.add(user);
        assert!(repo.get_by_id(1).is_some());
    }
}