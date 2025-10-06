using System;
using System.Collections.Generic;
using System.Linq;

namespace TestNamespace
{
    public interface IRepository<T>
    {
        T GetById(int id);
        void Add(T entity);
    }

    [Serializable]
    public class UserRepository : IRepository<User>
    {
        private readonly List<User> _users;

        public UserRepository()
        {
            _users = new List<User>();
        }

        public User GetById(int id)
        {
            return _users.FirstOrDefault(u => u.Id == id);
        }

        public async Task<User> GetByIdAsync(int id)
        {
            await Task.Delay(100);
            return GetById(id);
        }

        public void Add(User entity)
        {
            _users.Add(entity);
        }

        public IEnumerable<User> SearchUsers(string name)
        {
            return from user in _users
                   where user.Name.Contains(name)
                   orderby user.Name
                   select user;
        }
    }

    public record User(int Id, string Name, string Email);

    public enum UserRole
    {
        Admin,
        User,
        Guest
    }
}